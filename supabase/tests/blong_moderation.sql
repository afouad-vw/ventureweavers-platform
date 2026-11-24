-- BLong automatic moderation (Phase 19b): rules, held messages, auto-hide, new members. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;
update public.blong_settings set approve_communities = false, approve_discussions = false;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000f101', 'host@test', '{"name":"Hana Host"}'),
  ('00000000-0000-0000-0000-00000000f102', 'newbie@test', '{"name":"Nour Newbie"}'),
  ('00000000-0000-0000-0000-00000000f103', 'r1@test', '{"name":"Rami One"}'),
  ('00000000-0000-0000-0000-00000000f104', 'r2@test', '{"name":"Rana Two"}'),
  ('00000000-0000-0000-0000-00000000f105', 'r3@test', '{"name":"Reem Three"}'),
  ('00000000-0000-0000-0000-00000000f109', 'mod19@test', '{}');
insert into public.admin_users (user_id, username, display_name, permissions) values
  ('00000000-0000-0000-0000-00000000f109', 'comm.mod19', 'Community Mod', '{community.manage}');
update public.profiles set onboarded_at = now(), visibility = 'public' where id::text like '00000000-0000-0000-0000-00000000f10%';
-- Everyone but the newbie joined a month ago.
update public.profiles set created_at = now() - interval '30 days' where id::text like '00000000-0000-0000-0000-00000000f10%' and id <> '00000000-0000-0000-0000-00000000f102';

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
create temp table s (k text primary key, v text);
grant all on s to authenticated;

-- Rule helpers
select pg_temp.check(public.blong_link_count('see https://x.com and www.y.org or acme.io, not 3.5') = 3, 'links are counted');
select pg_temp.check(public.blong_has_word('This is a SCAM offer', 'scam') and not public.blong_has_word('scampi tonight', 'scam'), 'blocked words match whole words in any case');
select pg_temp.check(public.blong_has_word('get rich quick today', 'rich quick') and public.blong_has_word('a.b test', 'a.b'), 'phrases and symbols match literally');

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000f109');
select public.set_blong_settings('{"blocked_words": [" Scam ", "scam", "get rich quick", ""], "blocked_domains": ["https://www.Spam.example"], "max_links": 2}');
select pg_temp.check((public.blong_admin_settings() -> 'blocked_words') = '["get rich quick", "scam"]'::jsonb, 'word lists are cleaned');
select pg_temp.check((public.blong_admin_settings() -> 'blocked_domains') = '["spam.example"]'::jsonb, 'domains are cleaned');

-- A room
select pg_temp.as_user('00000000-0000-0000-0000-00000000f101');
insert into s values ('room_slug', public.create_discussion('Pricing your SaaS', 'Talk pricing.', 'Building and growth', '{}', 50, 'public'));
insert into s select 'room', id::text from public.discussions where slug = (select v from s where k = 'room_slug');
select pg_temp.check(public.post_room_message((select v::uuid from s where k = 'room'), 'Welcome! What do you charge?') is not null, 'normal messages post');

-- Blocked words: held
insert into s values ('held', public.post_room_message((select v::uuid from s where k = 'room'), 'This is not a scam, promise')::text);
select pg_temp.check((select count(*) = 2 from public.room_messages((select v::uuid from s where k = 'room'))), 'the author sees their held message');
select pg_temp.check((select mod_status from public.room_messages((select v::uuid from s where k = 'room')) where id = (select v::uuid from s where k = 'held')) = 'held', 'marked as held for the author');
select pg_temp.expect_error($$select public.post_room_message((select v::uuid from s where k = 'room'), 'Visit spam.example now')$$, '%mod_blocked_link%', 'blocked domains are refused');
select pg_temp.expect_error($$select public.post_room_message((select v::uuid from s where k = 'room'), 'a.com b.com c.com')$$, '%mod_too_many_links%', 'too many links are refused');
select pg_temp.expect_error($$select public.post_room_message((select v::uuid from s where k = 'room'), 'Welcome! What do you charge?')$$, '%mod_duplicate%', 'the same message twice is refused');
select pg_temp.expect_error($$select public.pin_room_message((select v::uuid from s where k = 'room'), (select v::uuid from s where k = 'held'))$$, '%not_found%', 'held messages can''t be pinned');

select pg_temp.as_user('00000000-0000-0000-0000-00000000f103');
select public.join_discussion((select v::uuid from s where k = 'room'));
select pg_temp.check((select count(*) = 1 from public.room_messages((select v::uuid from s where k = 'room'))), 'others don''t see held messages');
select pg_temp.check((select count(*) = 1 from public.discussion_messages where discussion_id = (select v::uuid from s where k = 'room')), 'row level security hides them too');

-- Slow down
reset role;
update public.blong_settings set per_minute = 2;
set local role authenticated;
select public.post_room_message((select v::uuid from s where k = 'room'), 'one');
select public.post_room_message((select v::uuid from s where k = 'room'), 'two');
select pg_temp.expect_error($$select public.post_room_message((select v::uuid from s where k = 'room'), 'three')$$, '%mod_slow_down%', 'too many messages a minute slow a member down');
reset role;
update public.blong_settings set per_minute = 60;
set local role authenticated;

-- Reject mode
select pg_temp.as_user('00000000-0000-0000-0000-00000000f109');
select public.set_blong_settings('{"blocked_action": "reject"}');
select pg_temp.as_user('00000000-0000-0000-0000-00000000f103');
select pg_temp.expect_error($$select public.post_room_message((select v::uuid from s where k = 'room'), 'get rich quick with me')$$, '%mod_blocked_word%', 'Reject refuses blocked words');
select pg_temp.as_user('00000000-0000-0000-0000-00000000f109');
select public.set_blong_settings('{"blocked_action": "hold"}');

-- Staff review
select pg_temp.as_user('00000000-0000-0000-0000-00000000f103');
select pg_temp.expect_error($$select public.blong_held()$$, '%not_admin%', 'members can''t open the Held queue');
select pg_temp.as_user('00000000-0000-0000-0000-00000000f109');
select pg_temp.check((select count(*) = 1 from public.blong_held() where mod_rule = 'blocked_word'), 'staff see the held message and the rule');
select public.review_held_message((select v::uuid from s where k = 'held'), true);
select pg_temp.as_user('00000000-0000-0000-0000-00000000f103');
select pg_temp.check((select count(*) = 1 from public.room_messages((select v::uuid from s where k = 'room')) where id = (select v::uuid from s where k = 'held')), 'published messages show for everyone');

-- Auto-hide after 3 reports
select pg_temp.as_user('00000000-0000-0000-0000-00000000f101');
insert into s values ('bad', public.post_room_message((select v::uuid from s where k = 'room'), 'Rude message')::text);
select pg_temp.as_user('00000000-0000-0000-0000-00000000f103');
select public.report_content('room_message', (select v::uuid from s where k = 'bad'), 'harassment');
select pg_temp.as_user('00000000-0000-0000-0000-00000000f104');
select public.join_discussion((select v::uuid from s where k = 'room'));
select public.report_content('room_message', (select v::uuid from s where k = 'bad'), 'harassment');
select pg_temp.check((select count(*) = 1 from public.room_messages((select v::uuid from s where k = 'room')) where id = (select v::uuid from s where k = 'bad')), 'two reports don''t hide it');
select pg_temp.as_user('00000000-0000-0000-0000-00000000f105');
select public.join_discussion((select v::uuid from s where k = 'room'));
select public.report_content('room_message', (select v::uuid from s where k = 'bad'), 'harassment');
select pg_temp.check((select count(*) = 0 from public.room_messages((select v::uuid from s where k = 'room')) where id = (select v::uuid from s where k = 'bad')), 'the third report hides it');
select pg_temp.as_user('00000000-0000-0000-0000-00000000f101');
select pg_temp.check((select mod_status from public.room_messages((select v::uuid from s where k = 'room')) where id = (select v::uuid from s where k = 'bad')) = 'hidden', 'its author sees it as hidden');
select pg_temp.as_user('00000000-0000-0000-0000-00000000f109');
select public.review_held_message((select v::uuid from s where k = 'bad'), false);
reset role;
select pg_temp.check((select removed_at is not null from public.discussion_messages where id = (select v::uuid from s where k = 'bad')), 'staff remove it');
select pg_temp.check((select count(*) = 0 from public.reports where target_id = (select v::uuid from s where k = 'bad') and status = 'open'), 'its reports are closed');
select pg_temp.check((select count(*) = 4 from public.moderation_log), 'held, published, hidden and removed are logged');
set local role authenticated;

-- A community auto-hidden after reports
select pg_temp.as_user('00000000-0000-0000-0000-00000000f101');
insert into s values ('com_slug', public.create_community('Growth hackers', 'Growth.', 'Interest', '{}', '{}', 'public'));
insert into s select 'com', id::text from public.communities where slug = (select v from s where k = 'com_slug');
select pg_temp.as_user('00000000-0000-0000-0000-00000000f103'); select public.report_content('community', (select v::uuid from s where k = 'com'), 'spam');
select pg_temp.as_user('00000000-0000-0000-0000-00000000f104'); select public.report_content('community', (select v::uuid from s where k = 'com'), 'spam');
select pg_temp.as_user('00000000-0000-0000-0000-00000000f105'); select public.report_content('community', (select v::uuid from s where k = 'com'), 'spam');
reset role;
select pg_temp.check((select status = 'archived' and archived_by_team from public.communities where id = (select v::uuid from s where k = 'com')), 'communities hide after 3 reports');
set local role authenticated;

-- Blocked words in a name send it for approval even with approval off
select pg_temp.as_user('00000000-0000-0000-0000-00000000f101');
insert into s values ('com2', public.create_community('Scam spotters', 'We spot them.', 'Interest', '{}', '{}', 'public'));
reset role;
select pg_temp.check((select status from public.communities where slug = (select v from s where k = 'com2')) = 'pending', 'a held name waits for approval');
set local role authenticated;

-- New members
select pg_temp.as_user('00000000-0000-0000-0000-00000000f102');
select pg_temp.expect_error($$select public.create_community('My club', 'x', 'Interest', '{}', '{}', 'public')$$, '%mod_new_member%', 'new members can''t create communities');
select pg_temp.expect_error($$select public.create_discussion('My room', 'x', 'Other', '{}', 10, 'public')$$, '%mod_new_member%', 'or discussions');
select pg_temp.expect_error($$select public.start_dm('00000000-0000-0000-0000-00000000f103')$$, '%mod_new_member%', 'new members only message people who follow them');
select public.join_discussion((select v::uuid from s where k = 'room'));
insert into s values ('n1', public.post_room_message((select v::uuid from s where k = 'room'), 'Hi all, new here')::text);
reset role;
select pg_temp.check((select mod_status from public.discussion_messages where id = (select v::uuid from s where k = 'n1')) = 'held', 'a new member''s first messages are held');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000f103');
select public.follow_member('00000000-0000-0000-0000-00000000f102');
select pg_temp.as_user('00000000-0000-0000-0000-00000000f102');
insert into s values ('t', public.start_dm('00000000-0000-0000-0000-00000000f103')::text);
select public.send_dm((select v::uuid from s where k = 't'), 'Thanks for the follow!');
select pg_temp.expect_error($$select public.send_dm((select v::uuid from s where k = 't'), 'Check https://my.site')$$, '%mod_new_member_links%', 'new members can''t send links in chats');
select pg_temp.expect_error($$select public.send_dm((select v::uuid from s where k = 't'), 'not a scam')$$, '%mod_blocked_word%', 'chats refuse blocked words instead of holding them');
reset role;
select pg_temp.check((select count(*) = 1 from public.dm_messages where thread_id = (select v::uuid from s where k = 't')), 'refused chat messages aren''t saved');

-- Overview numbers
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000f109');
select pg_temp.check((public.blong_mod_stats() ->> 'held_now')::int = 1 and (public.blong_mod_stats() ->> 'hidden_30')::int = 2, 'moderation numbers');

rollback;
