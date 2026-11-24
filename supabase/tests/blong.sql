-- BLong networking (Phase 18a): privacy, cards, follows, blocks, member messages and reports. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000b001', 'pub@test', '{"name":"Pia Public"}'),
  ('00000000-0000-0000-0000-00000000b002', 'priv@test', '{"name":"Pete Private"}'),
  ('00000000-0000-0000-0000-00000000b003', 'third@test', '{"name":"Tara Third"}'),
  ('00000000-0000-0000-0000-00000000b004', 'susp@test', '{"name":"Sam Suspended"}'),
  ('00000000-0000-0000-0000-00000000b009', 'commadmin@test', '{}'),
  ('00000000-0000-0000-0000-00000000b008', 'other.admin@test', '{}');
insert into public.admin_users (user_id, username, display_name, permissions) values
  ('00000000-0000-0000-0000-00000000b009', 'comm.admin', 'Community Admin', '{community.manage}'),
  ('00000000-0000-0000-0000-00000000b008', 'msg.only', 'Messages Admin', '{messages.manage}');
update public.profiles set onboarded_at = now(), roles = '{Founder}' where id in
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-00000000b003', '00000000-0000-0000-0000-00000000b004');
update public.profiles set visibility = 'public', bio = 'Building payments.', phone = '+201000000000',
  links = '[{"label":"Website","url":"https://example.com"}]' where id = '00000000-0000-0000-0000-00000000b001';
update public.profiles set bio = 'Quiet investor.', roles = '{Angel Investor}' where id = '00000000-0000-0000-0000-00000000b002';
insert into public.member_suspensions (member_id) values ('00000000-0000-0000-0000-00000000b004');

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

select pg_temp.check((select visibility from public.profiles where id = '00000000-0000-0000-0000-00000000b003') = 'private', 'new accounts start Private');

set local role authenticated;

-- Profile links are checked
select pg_temp.as_user('00000000-0000-0000-0000-00000000b003');
select pg_temp.expect_error($$update public.profiles set links = '[{"label":"Bad","url":"http://insecure.example"}]' where id = auth.uid()$$, '%profiles_links_check%', 'links must be https');
select pg_temp.expect_error($$update public.profiles set links = (select jsonb_agg(jsonb_build_object('label','L'||g,'url','https://e.com/'||g)) from generate_series(1,6) g) where id = auth.uid()$$, '%profiles_links_check%', 'at most 5 links');

-- Directory
select pg_temp.check((select count(*) = 2 from public.member_directory()), 'the directory lists other members, not admins, suspended members or yourself');
select pg_temp.check((select count(*) = 1 from public.member_directory('pia')), 'the directory searches by name');
select pg_temp.check((select count(*) = 1 from public.member_directory(null, 'Angel Investor')), 'the directory filters by role');

-- Cards: Public shows everything but email and phone; Private shows name, photo and roles only
select pg_temp.check((select (c->>'open')::boolean and c->>'bio' = 'Building payments.' and jsonb_array_length(c->'links') = 1 and not (c ? 'phone') and not (c ? 'email')
  from (select public.member_card('00000000-0000-0000-0000-00000000b001') c) x), 'a Public card shows bio and links, never phone or email');
select pg_temp.check((select not (c->>'open')::boolean and c->>'bio' is null and c->>'name' = 'Pete Private' and not (c->>'can_message')::boolean
  from (select public.member_card('00000000-0000-0000-0000-00000000b002') c) x), 'a Private card shows only name, photo and roles');
select pg_temp.check(public.member_card('00000000-0000-0000-0000-00000000b004') is null, 'suspended members have no card');
select pg_temp.check(public.member_card('00000000-0000-0000-0000-00000000b009') is null, 'admin accounts have no card');
select pg_temp.check((select count(*) = 1 from public.profiles), 'members still read only their own profile row');

-- Follows: Public at once, Private by request
select pg_temp.check(public.follow_member('00000000-0000-0000-0000-00000000b001') = 'following', 'following a Public account is instant');
select pg_temp.check(public.follow_member('00000000-0000-0000-0000-00000000b002') = 'requested', 'following a Private account sends a request');
select pg_temp.check(public.follow_member('00000000-0000-0000-0000-00000000b002') = 'requested', 'asking twice changes nothing');
select pg_temp.expect_error($$select public.follow_member('00000000-0000-0000-0000-00000000b003')$$, '%not_yourself%', 'you cannot follow yourself');
select pg_temp.expect_error($$select public.follow_member('00000000-0000-0000-0000-00000000b004')$$, '%not_found%', 'you cannot follow a suspended member');
select pg_temp.expect_error($$insert into public.follows (follower, followee, status) values (auth.uid(), '00000000-0000-0000-0000-00000000b002', 'accepted')$$, '%permission%', 'members cannot write follows directly');
select pg_temp.expect_error($$select public.start_dm('00000000-0000-0000-0000-00000000b002')$$, '%cannot_message%', 'you cannot message a Private account that has not accepted you');

-- The Private member accepts
select pg_temp.as_user('00000000-0000-0000-0000-00000000b002');
select pg_temp.check((select count(*) = 1 from public.my_network('requests')), 'the request shows for the Private member');
select pg_temp.check((select count(*) = 1 from public.notifications where text like '%asked to follow you.'), 'the Private member is told about the request');
select public.respond_follow('00000000-0000-0000-0000-00000000b003', true);

select pg_temp.as_user('00000000-0000-0000-0000-00000000b003');
select pg_temp.check((select (c->>'open')::boolean and c->>'bio' = 'Quiet investor.' from (select public.member_card('00000000-0000-0000-0000-00000000b002') c) x), 'an accepted follower sees the Private card');
select pg_temp.check((select count(*) = 2 from public.my_network('following')), 'following shows both members');
select pg_temp.check((select count(*) = 1 from public.notifications where text like '%accepted your follow request.'), 'the follower is told when a request is accepted');

-- Messages
select pg_temp.as_user('00000000-0000-0000-0000-00000000b003');
select public.send_dm(public.start_dm('00000000-0000-0000-0000-00000000b002'), 'Hi Pete, thanks for accepting.');
select public.send_dm(public.start_dm('00000000-0000-0000-0000-00000000b002'), 'Free for coffee next week?');
select pg_temp.check((select count(*) = 1 from public.dm_threads), 'one chat per pair');
select pg_temp.check(public.start_dm('00000000-0000-0000-0000-00000000b002') = public.start_dm('00000000-0000-0000-0000-00000000b002'), 'starting again finds the same chat');
select pg_temp.expect_error($$select public.send_dm((select id from public.dm_threads limit 1), '  ')$$, '%bad_message%', 'empty messages are refused');
select pg_temp.expect_error($$insert into public.dm_messages (thread_id, author, body) select id, auth.uid(), 'x' from public.dm_threads$$, '%permission%', 'members cannot write messages directly');

select pg_temp.as_user('00000000-0000-0000-0000-00000000b002');
select pg_temp.check((select unread = 2 and can_send from public.my_dm_threads()), 'the other member sees 2 unread and can reply');
select pg_temp.check((select count(*) = 1 from public.notifications where member_id = auth.uid() and text like 'New message from%'), 'one bell notification per unread run');
select public.mark_dm_read((select id from public.dm_threads limit 1));
select pg_temp.check(public.my_dm_unread() = 0, 'reading clears the count');
-- Pete (Private) can reply to Tara even though Tara is Private and Pete does not follow her: she wrote first.
select public.send_dm((select id from public.dm_threads limit 1), 'Sure, Tuesday?');

-- A third member sees nothing of it
select pg_temp.as_user('00000000-0000-0000-0000-00000000b001');
select pg_temp.check((select count(*) = 0 from public.dm_messages) and (select count(*) = 0 from public.dm_threads), 'members cannot read other members'' chats');
select pg_temp.check((select count(*) = 0 from public.follows where follower <> auth.uid() and followee <> auth.uid()), 'members see only follows they are part of');

-- Staff with only Messages access can't read member chats
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000b008');
set local role authenticated;
select pg_temp.check((select count(*) = 0 from public.dm_messages), 'team accounts cannot read member chats');

-- Reports
select pg_temp.as_user('00000000-0000-0000-0000-00000000b002');
select pg_temp.check(public.report_content('message', (select id from public.dm_messages where author = '00000000-0000-0000-0000-00000000b003' limit 1), 'spam', 'Selling') is not null, 'members report a message sent to them');
select pg_temp.expect_error($$select public.report_content('message', (select id from public.dm_messages where author = auth.uid() limit 1), 'spam')$$, '%not_found%', 'members cannot report their own message');
select pg_temp.expect_error($$select public.admin_handle_report((select id from public.reports limit 1), 'dismissed')$$, '%not_admin%', 'members cannot handle reports');

select pg_temp.as_user('00000000-0000-0000-0000-00000000b008');
select pg_temp.check((select count(*) = 0 from public.reports), 'staff without the Community area see no reports');

select pg_temp.as_user('00000000-0000-0000-0000-00000000b009');
select pg_temp.check((select count(*) = 1 and bool_and(excerpt like 'Hi Pete%' or excerpt like 'Free for%') from public.reports), 'Community staff see the report with only the reported message');
select pg_temp.check((select count(*) = 0 from public.dm_messages), 'Community staff still cannot read chats');
select public.admin_handle_report((select id from public.reports limit 1), 'handled', 'Warned the member');
select pg_temp.check((select status = 'handled' and handled_by is not null from public.reports limit 1), 'Community managers handle reports');

-- Blocks
select pg_temp.as_user('00000000-0000-0000-0000-00000000b002');
select public.block_member('00000000-0000-0000-0000-00000000b003');
select pg_temp.check((select count(*) = 0 from public.follows where follower = '00000000-0000-0000-0000-00000000b003' or followee = '00000000-0000-0000-0000-00000000b003'), 'blocking removes follows both ways');
select pg_temp.check((select count(*) = 0 from public.my_dm_threads()), 'a blocked member''s chat leaves your list');
select pg_temp.check((select count(*) = 1 from public.my_blocked()), 'blocked members are listed for unblocking');
select pg_temp.as_user('00000000-0000-0000-0000-00000000b003');
select pg_temp.check(public.member_card('00000000-0000-0000-0000-00000000b002') is null, 'a blocked member cannot see your card');
select pg_temp.check((select count(*) = 1 from public.member_directory()), 'you disappear from a blocked member''s directory');
select pg_temp.expect_error($$select public.send_dm((select id from public.dm_threads limit 1), 'hello?')$$, '%cannot_message%', 'a blocked member cannot message you');
select pg_temp.expect_error($$select public.follow_member('00000000-0000-0000-0000-00000000b002')$$, '%not_found%', 'a blocked member cannot follow you');
select pg_temp.as_user('00000000-0000-0000-0000-00000000b002');
select public.unblock_member('00000000-0000-0000-0000-00000000b003');
select pg_temp.check((select count(*) = 0 from public.my_blocked()), 'unblocking works');

-- Going Public accepts waiting requests
select pg_temp.as_user('00000000-0000-0000-0000-00000000b003');
select pg_temp.check(public.follow_member('00000000-0000-0000-0000-00000000b002') = 'requested', 'after unblocking, a new request can be sent');
select pg_temp.as_user('00000000-0000-0000-0000-00000000b002');
update public.profiles set visibility = 'public' where id = auth.uid();
select pg_temp.check((select status = 'accepted' from public.follows where follower = '00000000-0000-0000-0000-00000000b003' and followee = auth.uid()), 'switching to Public accepts waiting requests');

-- Limits: 30 follow requests an hour
reset role;
insert into auth.users (id, email) select ('00000000-0000-0000-0000-0000000c' || lpad(g::text, 4, '0'))::uuid, 'bulk' || g || '@test' from generate_series(1, 31) g;
update public.profiles set onboarded_at = now() where id::text like '00000000-0000-0000-0000-0000000c%';
select pg_temp.as_user('00000000-0000-0000-0000-00000000b001');
set local role authenticated;
select pg_temp.check((select count(*) = 30 from (select public.follow_member(('00000000-0000-0000-0000-0000000c' || lpad(g::text, 4, '0'))::uuid) from generate_series(1, 30) g) x), '30 follows in an hour are fine');
select pg_temp.expect_error($$select public.follow_member('00000000-0000-0000-0000-0000000c0031')$$, '%too_many_follows%', 'at most 30 follows an hour');

-- Suspended members can't take part
select pg_temp.as_user('00000000-0000-0000-0000-00000000b004');
select pg_temp.expect_error($$select public.follow_member('00000000-0000-0000-0000-00000000b001')$$, '%not_a_member%', 'suspended members cannot follow');

rollback;
