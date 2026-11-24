-- BLong discussions (Phase 18c): rooms, privacy, limits, messages, roles. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;
-- Phase 19a: approval is tested in blong_controls.sql; these tests create live items.
update public.blong_settings set approve_communities = false, approve_discussions = false;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000d101', 'host@test', '{"name":"Hana Host"}'),
  ('00000000-0000-0000-0000-00000000d102', 'guest@test', '{"name":"Gus Guest"}'),
  ('00000000-0000-0000-0000-00000000d103', 'third@test', '{"name":"Tia Third"}'),
  ('00000000-0000-0000-0000-00000000d109', 'staff@test', '{}');
insert into public.admin_users (user_id, username, display_name, permissions) values
  ('00000000-0000-0000-0000-00000000d109', 'room.staff', 'Room Staff', '{community.manage}');
update public.profiles set onboarded_at = now() where id::text like '00000000-0000-0000-0000-00000000d10%';

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
create temp table slugs (k text primary key, slug text);
grant all on slugs to authenticated;
create temp view ids as select s.k, d.id as v from slugs s join public.discussions d on d.slug = s.slug;
grant select on ids to authenticated;

set local role authenticated;

-- Create rooms
select pg_temp.as_user('00000000-0000-0000-0000-00000000d101');
insert into slugs values ('pub', public.create_discussion('Raising a pre-seed in 2027', 'Notes on rounds.', 'Fundraising', '{Pre-seed}', 2, 'public'));
insert into slugs values ('req', public.create_discussion('Hiring your first 10', 'Roles to hire first.', 'Careers and hiring', '{}', 10, 'request'));
insert into slugs values ('inv', public.create_discussion('Syndicate deal flow', 'Deals this month.', 'Investing', '{}', 10, 'invite'));
select pg_temp.check((select count(*) = 3 from slugs), 'three rooms created');
select pg_temp.expect_error($$select public.create_discussion('Bad', 'd', 'Gossip', '{}', 10, 'public')$$, '%discussions_category_check%', 'categories come from the list');
select pg_temp.expect_error($$select public.create_discussion('Too big', 'd', 'Other', '{}', 900, 'public')$$, '%member_limit%', 'member limits are 2 to 500');
-- A community room
create temp table cs (slug text);
grant all on cs to authenticated;
insert into cs values (public.create_community('Founders Hub', 'For founders.', 'Interest', '{}', '{}', 'private'));
insert into slugs values ('com', public.create_discussion('Inside the hub', 'Members only.', 'Other', '{}', 20, 'public', (select id from public.communities where slug = (select slug from cs))));
select pg_temp.check(public.post_room_message((select v from ids where k = 'pub'), 'Welcome! Share what changed in your round.') is not null, 'hosts post');

-- What others find
select pg_temp.as_user('00000000-0000-0000-0000-00000000d102');
select pg_temp.check((select count(*) = 2 from public.list_discussions('explore')), 'Explore shows Public and Request rooms, not Invite-only or other communities'' rooms');
select pg_temp.check((select count(*) = 1 from public.room_messages((select id from public.discussions where slug = (select slug from slugs where k = 'pub')))), 'anyone can read a Public room');
select pg_temp.check(public.discussion_page((select slug from slugs where k = 'inv')) is null, 'Invite-only rooms are hidden');
select pg_temp.check(public.discussion_page((select slug from slugs where k = 'com')) is null, 'community rooms are hidden from non-members');
select pg_temp.expect_error($$select public.create_discussion('Sneaky', 'd', 'Other', '{}', 10, 'public', (select id from public.communities limit 1))$$, '%not_in_community%', 'only community members start rooms inside it');
select pg_temp.expect_error($$select public.post_room_message((select id from public.discussions where slug = (select slug from slugs where k = 'pub')), 'hi')$$, '%not_a_room_member%', 'only room members post');
select pg_temp.check(public.join_discussion((select id from public.discussions where slug = (select slug from slugs where k = 'pub'))) = 'active', 'Public rooms join at once');
select pg_temp.check(public.join_discussion((select id from public.discussions where slug = (select slug from slugs where k = 'req'))) = 'requested', 'Request rooms take a request');
select pg_temp.check((select count(*) = 0 from public.room_messages((select id from public.discussions where slug = (select slug from slugs where k = 'req')))) and
  not (public.discussion_page((select slug from slugs where k = 'req'))->>'can_read')::boolean, 'a pending member cannot read a Request room');
-- Reply notifies the author
select pg_temp.check(public.post_room_message((select id from public.discussions where slug = (select slug from slugs where k = 'pub')), 'Angels now want a seed lead in sight.',
  (select id from public.discussion_messages where body like 'Welcome!%')) is not null, 'members reply');

-- Room limit: 2
select pg_temp.as_user('00000000-0000-0000-0000-00000000d103');
select pg_temp.expect_error($$select public.join_discussion((select id from public.discussions where slug = (select slug from slugs where k = 'pub')))$$, '%room_full%', 'full rooms refuse new members');
select pg_temp.expect_error($$select public.join_discussion((select id from public.discussions where slug = (select slug from slugs where k = 'inv')))$$, '%not_found%', 'Invite-only rooms can''t be joined uninvited');

-- Host: replies, requests, invites, pins, roles, closing
select pg_temp.as_user('00000000-0000-0000-0000-00000000d101');
select pg_temp.check((select count(*) = 1 from public.notifications where text like 'Gus Guest replied to you in%'), 'replies tell the person replied to');
select pg_temp.check((select count(*) = 1 from public.notifications where text like 'Gus Guest asked to join the discussion%'), 'hosts hear about requests');
select public.respond_discussion_join((select id from public.discussions where slug = (select slug from slugs where k = 'req')), '00000000-0000-0000-0000-00000000d102', true);
select pg_temp.check(public.invite_to_discussion((select id from public.discussions where slug = (select slug from slugs where k = 'inv')), '00000000-0000-0000-0000-00000000d103') = 'invited', 'hosts invite');
select pg_temp.expect_error($$select public.update_discussion((select id from public.discussions where slug = (select slug from slugs where k = 'pub')), 'Raising', 'd', 'Fundraising', '{}', 1, 'public')$$, '%limit_below_members%', 'limits can''t drop below the members already in');
select public.pin_room_message((select id from public.discussions where slug = (select slug from slugs where k = 'pub')), (select id from public.discussion_messages where body like 'Welcome!%'));
select pg_temp.check((select (c->'pinned'->>'body') like 'Welcome!%' from (select public.discussion_page((select slug from slugs where k = 'pub')) c) x), 'hosts pin a message');
select public.remove_room_message((select id from public.discussion_messages where body like 'Angels%'));
select pg_temp.check((select removed and body = '' from public.room_messages((select id from public.discussions where slug = (select slug from slugs where k = 'pub'))) where author = '00000000-0000-0000-0000-00000000d102'), 'hosts remove messages; the text is gone');
select public.set_discussion_status((select id from public.discussions where slug = (select slug from slugs where k = 'pub')), 'closed');
select pg_temp.expect_error($$select public.post_room_message((select id from public.discussions where slug = (select slug from slugs where k = 'pub')), 'still here?')$$, '%room_closed%', 'closed rooms are read-only');
select pg_temp.expect_error($$select public.leave_discussion((select id from public.discussions where slug = (select slug from slugs where k = 'pub')))$$, '%owner_must_transfer%', 'owners hand over before leaving');

select pg_temp.as_user('00000000-0000-0000-0000-00000000d103');
select pg_temp.check(public.join_discussion((select id from public.discussions where slug = (select slug from slugs where k = 'inv'))) = 'active', 'invited members join Invite-only rooms');

select pg_temp.as_user('00000000-0000-0000-0000-00000000d102');
select pg_temp.check((select count(*) = 2 from public.room_messages((select id from public.discussions where slug = (select slug from slugs where k = 'pub')))), 'members still read a closed room');
select pg_temp.expect_error($$select public.remove_room_message((select id from public.discussion_messages where body like 'Welcome!%'))$$, '%not_allowed%', 'members can''t remove others'' messages');
select pg_temp.expect_error($$select public.pin_room_message((select id from public.discussions where slug = (select slug from slugs where k = 'req')), null)$$, '%not_allowed%', 'members can''t pin');
select pg_temp.check(public.report_content('room_message', (select id from public.discussion_messages where body like 'Welcome!%'), 'spam') is not null, 'members report a room message');
select pg_temp.expect_error($$insert into public.discussion_messages (discussion_id, author, body) select id, auth.uid(), 'x' from public.discussions limit 1$$, '%permission%', 'members cannot write messages directly');

-- Staff
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000d109');
set local role authenticated;
select pg_temp.check((select count(*) = 0 from public.discussion_messages), 'staff can''t read room messages directly');
select pg_temp.check((select excerpt like 'Welcome!%' from public.reports where kind = 'room_message'), 'staff see the reported room message');
select public.set_discussion_status((select id from public.discussions where slug = (select slug from slugs where k = 'req')), 'archived');
select pg_temp.as_user('00000000-0000-0000-0000-00000000d101');
select pg_temp.expect_error($$select public.set_discussion_status((select id from public.discussions where slug = (select slug from slugs where k = 'req')), 'open')$$, '%archived_by_team%', 'owners can''t reopen what the team archived');

rollback;
