-- BLong admin controls (Phase 19a): section switches, approval, settings, stats. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000e101', 'maker@test', '{"name":"Mia Maker"}'),
  ('00000000-0000-0000-0000-00000000e102', 'other@test', '{"name":"Omar Other"}'),
  ('00000000-0000-0000-0000-00000000e108', 'viewer@test', '{}'),
  ('00000000-0000-0000-0000-00000000e109', 'mod@test', '{}');
insert into public.admin_users (user_id, username, display_name, permissions) values
  ('00000000-0000-0000-0000-00000000e108', 'comm.viewer', 'Community Viewer', '{community.view}'),
  ('00000000-0000-0000-0000-00000000e109', 'comm.mod', 'Community Mod', '{community.manage}');
update public.profiles set onboarded_at = now() where id::text like '00000000-0000-0000-0000-00000000e10%';

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
create temp table s (k text primary key, slug text);
grant all on s to authenticated;
create temp view c as select s.k, x.id, x.status from s join public.communities x on x.slug = s.slug;
create temp view d as select s.k, x.id, x.status from s join public.discussions x on x.slug = s.slug;
grant select on c, d to authenticated;

set local role authenticated;

-- ---------------------------------------------------------------- approval
select pg_temp.as_user('00000000-0000-0000-0000-00000000e101');
select pg_temp.check((public.blong_sections() ->> 'communities')::boolean, 'members can read the section switches');
insert into s values ('com', public.create_community('Fintech builders', 'For fintech founders.', 'Industry or sector', '{Fintech}', '{}', 'public'));
insert into s values ('room', public.create_discussion('Licensing in Egypt', 'Notes on licences.', 'Building and growth', '{}', 20, 'public'));
select pg_temp.check((select status from c where k = 'com') = 'pending', 'new communities wait for approval');
select pg_temp.check((select status from d where k = 'room') = 'pending', 'new discussions wait for approval');
select pg_temp.check((select count(*) = 1 from public.list_communities('owned')), 'the creator sees their pending community in Owned');
select pg_temp.check(public.community_page((select slug from s where k = 'com')) is not null, 'the creator opens their pending community');
select pg_temp.expect_error($$select public.post_room_message((select id from d where k = 'room'), 'hello')$$, '%pending_review%', 'no posting before approval');
select pg_temp.expect_error($$select public.invite_to_community((select id from c where k = 'com'), '00000000-0000-0000-0000-00000000e102')$$, '%pending_review%', 'no invites before approval');
select pg_temp.expect_error($$select public.set_community_status((select id from c where k = 'com'), 'active')$$, '%pending_review%', 'creators can''t make it live themselves');
select pg_temp.expect_error($$select public.blong_pending()$$, '%not_admin%', 'members can''t see the approval queue');

select pg_temp.as_user('00000000-0000-0000-0000-00000000e102');
select pg_temp.check((select count(*) = 0 from public.list_communities('explore')), 'others don''t find a pending community');
select pg_temp.check((select count(*) = 0 from public.list_discussions('explore')), 'others don''t find a pending discussion');
select pg_temp.check(public.community_page((select slug from s where k = 'com')) is null, 'pending community pages are hidden');
select pg_temp.check(public.discussion_page((select slug from s where k = 'room')) is null, 'pending discussion pages are hidden');
select pg_temp.check((select count(*) = 0 from public.communities where slug = (select slug from s where k = 'com')), 'row level security hides pending communities');
select pg_temp.expect_error($$select public.join_community((select id from public.communities where slug = (select slug from s where k = 'com')))$$, '%', 'others can''t join a pending community');

-- Staff review
select pg_temp.as_user('00000000-0000-0000-0000-00000000e108');
select pg_temp.check((select count(*) = 2 from public.blong_pending()), 'Community (view) sees the queue');
select pg_temp.expect_error($$select public.review_blong_item('community', (select id from public.communities where slug = (select slug from s where k = 'com')), true)$$, '%not_admin%', 'view-only staff can''t approve');
select pg_temp.as_user('00000000-0000-0000-0000-00000000e109');
select pg_temp.expect_error($$select public.review_blong_item('discussion', (select id from public.discussions where slug = (select slug from s where k = 'room')), false)$$, '%note_needed%', 'declining needs a note');
select public.review_blong_item('community', (select id from public.communities where slug = (select slug from s where k = 'com')), true);
select public.review_blong_item('discussion', (select id from public.discussions where slug = (select slug from s where k = 'room')), false, 'Please add what you want to discuss.');
select pg_temp.check((select status from public.communities where slug = (select slug from s where k = 'com')) = 'active', 'approved communities go live');
select pg_temp.check((select status from public.discussions where slug = (select slug from s where k = 'room')) = 'declined', 'declined discussions stay hidden');
reset role;
select pg_temp.check((select count(*) = 2 from public.notifications where member_id = '00000000-0000-0000-0000-00000000e101' and (text like '%is live%' or text like '%wasn''t approved%')), 'the creator is told both outcomes');
set local role authenticated;
reset role;
select pg_temp.check((select count(*) = 2 from public.audit_log where action in ('blong.approve', 'blong.decline')), 'reviews are logged');
set local role authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-00000000e102');
select pg_temp.check(public.join_community((select id from public.communities where slug = (select slug from s where k = 'com'))) = 'active', 'others join once it''s approved');

-- Resubmitting once
select pg_temp.as_user('00000000-0000-0000-0000-00000000e101');
select pg_temp.check(public.discussion_page((select slug from s where k = 'room')) ->> 'review_note' = 'Please add what you want to discuss.', 'the creator sees the note');
select public.update_discussion((select id from d where k = 'room'), 'Licensing in Egypt', 'Which licences fintechs need and how long they take.', 'Building and growth', '{}', 20, 'public');
select pg_temp.check((select status from d where k = 'room') = 'pending', 'editing a declined discussion sends it back for review');
reset role;
update public.discussions set status = 'declined' where slug = (select slug from s where k = 'room');
set local role authenticated;
select public.update_discussion((select id from d where k = 'room'), 'Licensing in Egypt', 'Again.', 'Building and growth', '{}', 20, 'public');
select pg_temp.check((select status from d where k = 'room') = 'declined', 'only one resubmission');

-- ---------------------------------------------------------------- settings
select pg_temp.expect_error($$select public.set_blong_settings('{"communities_on": false}')$$, '%not_admin%', 'members can''t change settings');
select pg_temp.as_user('00000000-0000-0000-0000-00000000e108');
select pg_temp.expect_error($$select public.set_blong_settings('{"communities_on": false}')$$, '%not_admin%', 'view-only staff can''t change settings');
select pg_temp.check((public.blong_admin_settings() ->> 'approve_communities')::boolean, 'view-only staff read settings');
select pg_temp.check((public.blong_stats() ->> 'members')::int >= 2 and jsonb_array_length(public.blong_stats() -> 'daily') = 30, 'stats count members and 30 days');
select pg_temp.as_user('00000000-0000-0000-0000-00000000e109');
select public.set_blong_settings('{"approve_communities": false}');
select pg_temp.as_user('00000000-0000-0000-0000-00000000e101');
insert into s values ('com2', public.create_community('Climate founders', 'Climate.', 'Interest', '{}', '{}', 'public'));
select pg_temp.check((select status from c where k = 'com2') = 'active', 'with approval off, communities go live at once');

-- ---------------------------------------------------------------- section switches
select pg_temp.as_user('00000000-0000-0000-0000-00000000e102');
select pg_temp.expect_error($$insert into public.waitlist_entries (item_type, item_id) values ('blong_section', public.blong_section_id('communities'))$$, '%not_coming_soon%', 'no Notify me while the section is open');
select pg_temp.as_user('00000000-0000-0000-0000-00000000e109');
select public.set_blong_settings('{"communities_on": false}');
reset role;
select pg_temp.check((select count(*) = 1 from public.audit_log where action = 'blong.settings' and (after ->> 'communities_on')::boolean = false), 'switches are logged');
set local role authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-00000000e102');
select pg_temp.check(not (public.blong_sections() ->> 'communities')::boolean, 'members see Communities is off');
select pg_temp.check((select count(*) = 0 from public.list_communities('joined')), 'switched-off communities disappear from lists');
select pg_temp.check(public.community_page((select slug from s where k = 'com')) is null, 'and their pages');
select pg_temp.check((select count(*) = 0 from public.communities), 'and from row level security');
select pg_temp.expect_error($$select public.create_community('New one', 'x', 'Interest', '{}', '{}', 'public')$$, '%section_off%', 'nothing new while off');
select pg_temp.expect_error($$select public.leave_community((select id from public.communities limit 1))$$, '%', 'no leaving while off');
insert into public.waitlist_entries (item_type, item_id) values ('blong_section', public.blong_section_id('communities'));
reset role;
select pg_temp.check((select count(*) = 1 from public.waitlist_entries where member_id = '00000000-0000-0000-0000-00000000e102'), 'members press Notify me while it''s off');
set local role authenticated;
select pg_temp.expect_error($$insert into public.waitlist_entries (item_type, item_id) values ('blong_section', public.blong_section_id('discussions'))$$, '%not_coming_soon%', 'but not for an open section');

select pg_temp.as_user('00000000-0000-0000-0000-00000000e109');
select pg_temp.check(public.community_page((select slug from s where k = 'com')) is not null, 'staff still see communities while off');
select public.set_blong_settings('{"communities_on": true, "discussions_on": false}');
reset role;
select pg_temp.check((select count(*) = 1 from public.notifications where member_id = '00000000-0000-0000-0000-00000000e102' and text like 'BLong communities are open%'), 'switching on tells the list');
set local role authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-00000000e101');
select pg_temp.check((select count(*) = 0 from public.list_discussions('owned')), 'switched-off discussions disappear');
select pg_temp.expect_error($$select public.create_discussion('Off', 'x', 'Other', '{}', 10, 'public')$$, '%section_off%', 'no new discussions while off');
select pg_temp.check((select count(*) >= 2 from public.list_communities('owned')), 'communities come back as they were');

rollback;
