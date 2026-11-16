-- Messages between members and the team, episode series and synced Shorts. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'msg1@test', '{"name":"Msg One"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'msg2@test', '{"name":"Msg Two"}'),
  ('00000000-0000-0000-0000-0000000000a8', 'msgview@test', '{}'),
  ('00000000-0000-0000-0000-0000000000a9', 'msgadmin@test', '{}'),
  ('00000000-0000-0000-0000-0000000000a7', 'content@test', '{}');
insert into public.admin_users (user_id, username, display_name, permissions) values
  ('00000000-0000-0000-0000-0000000000a9', 'msg.admin', 'Msg Admin', '{messages.manage}'),
  ('00000000-0000-0000-0000-0000000000a8', 'msg.viewer', 'Msg Viewer', '{messages.view}'),
  ('00000000-0000-0000-0000-0000000000a7', 'content.ed', 'Content Editor', '{content.manage}');

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', label; end if;
  raise notice 'ok - %', label;
end $$;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated;
create function pg_temp.expect_error(stmt text, code_like text, label text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % (no error)', label;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlerrm not like code_like then raise exception 'FAIL: % (got %)', label, sqlerrm; end if;
  raise notice 'ok - %', label;
end $$;
grant execute on function pg_temp.expect_error(text, text, text) to anon, authenticated;
create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(text) to anon, authenticated;

set local role authenticated;

-- A member starts a conversation
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select (r->>'alert')::boolean and (r->>'new')::boolean from (select public.send_message('Hello, I have a question about TVAC.') r) x), 'the first message starts a thread and alerts the inbox');
select pg_temp.check((select not (r->>'alert')::boolean from (select public.send_message('One more thing.') r) x), 'a quick follow-up does not email the inbox again');
select pg_temp.check((select count(*) = 2 from public.messages), 'members see their own messages');
select pg_temp.expect_error($$select public.send_message('   ')$$, '%bad_message%', 'empty messages are refused');
select pg_temp.expect_error($$select public.send_message(repeat('x', 2001))$$, '%bad_message%', 'messages are at most 2,000 characters');
select pg_temp.expect_error($$insert into public.messages (thread_id, body, from_team) select id, 'fake reply', true from public.message_threads$$, '%permission%', 'members cannot write messages directly');
select pg_temp.expect_error($$select public.team_send_message((select id from public.message_threads limit 1), 'I am the team')$$, '%not_admin%', 'members cannot reply as the team');

-- Another member sees nothing
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.check((select count(*) = 0 from public.messages) and (select count(*) = 0 from public.message_threads), 'members cannot read other members'' messages');

-- Rate limit: 20 an hour
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select public.send_message('msg ' || g) from generate_series(1, 20) g;
select pg_temp.expect_error($$select public.send_message('twenty-first')$$, '%too_many_messages%', 'at most 20 messages an hour');

-- Viewers read, managers reply
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a8');
select pg_temp.check((select count(*) = 2 from public.message_threads), 'Messages viewers see every thread');
select pg_temp.expect_error($$select public.team_send_message((select id from public.message_threads where member_id = '00000000-0000-0000-0000-0000000000a1'), 'hi')$$, '%not_admin%', 'view-only staff cannot reply');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a7');
select pg_temp.check((select count(*) = 0 from public.message_threads), 'staff without the Messages area see no threads');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a9');
select public.team_send_message((select id from public.message_threads where member_id = '00000000-0000-0000-0000-0000000000a1'), 'Happy to help. The next cohort dates are TBA.');
select public.team_set_thread_status((select id from public.message_threads where member_id = '00000000-0000-0000-0000-0000000000a1'), 'done');
select pg_temp.expect_error($$select public.send_message('admins are not members')$$, '%admin_account%', 'admin accounts do not open member threads');
reset role;
select pg_temp.check((select count(*) = 1 from public.notifications where member_id = '00000000-0000-0000-0000-0000000000a1' and href = '/messages'), 'the member is told about the reply in their bell');
select pg_temp.check((select count(*) = 1 and bool_and(author = '00000000-0000-0000-0000-0000000000a9') from public.messages where from_team), 'replies are marked as from the team');

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select (r->>'alert')::boolean from (select public.send_message('Reopening this.') r) x), 'writing to a closed thread reopens it and alerts the inbox');
select pg_temp.check((select status = 'open' from public.message_threads), 'the thread is open again');
select public.mark_my_messages_read();

-- Series and synced Shorts
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a7');
insert into public.content_series (name, description, position) values ('Founder Stories', 'Long conversations', 10);
update public.content_series set name = 'Founder Stories S1' where name = 'Founder Stories';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) >= 7 from public.content_series), 'members read the series list');
select pg_temp.expect_error($$insert into public.content_series (name) values ('Hacked')$$, '%row-level security%', 'members cannot add series');
reset role;
insert into public.content_items (title, series, format, platform, url, status, source, external_id)
values ('Synced short', 'Shorts', 'Short', 'YouTube', 'https://www.youtube.com/shorts/abcdefghijk', 'published', 'youtube', 'abcdefghijk');
select pg_temp.expect_error($$insert into public.content_items (title, series, format, platform, status, source, external_id) values ('Same short', 'Shorts', 'Short', 'YouTube', 'published', 'youtube', 'abcdefghijk')$$, '%duplicate%', 'a synced post is stored once');
select pg_temp.expect_error($$insert into public.content_items (title, series, format, platform, status) values ('Bad series', 'Nope', 'Episode', 'YouTube', 'draft')$$, '%foreign key%', 'episodes belong to a known series');
update public.content_series set name = 'Short clips' where name = 'Shorts';
select pg_temp.check((select series = 'Short clips' from public.content_items where external_id = 'abcdefghijk'), 'renaming a series moves its items with it');
select pg_temp.check('messages.manage' = any (public.admin_perm_list()), 'Messages is an admin access area');

rollback;
