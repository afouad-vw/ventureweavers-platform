-- BLong communities (Phase 18b): create, join, requests, invites, roles and who sees what. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;
-- Phase 19a: approval is tested in blong_controls.sql; these tests create live items.
update public.blong_settings set approve_communities = false, approve_discussions = false;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000c101', 'owner@test', '{"name":"Olga Owner"}'),
  ('00000000-0000-0000-0000-00000000c102', 'joiner@test', '{"name":"Jo Joiner"}'),
  ('00000000-0000-0000-0000-00000000c103', 'outsider@test', '{"name":"Otto Outsider"}'),
  ('00000000-0000-0000-0000-00000000c109', 'commstaff@test', '{}');
insert into public.admin_users (user_id, username, display_name, permissions) values
  ('00000000-0000-0000-0000-00000000c109', 'comm.staff', 'Community Staff', '{community.manage}');
update public.profiles set onboarded_at = now() where id::text like '00000000-0000-0000-0000-00000000c10%';

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
create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;


set local role authenticated;

-- Create
select pg_temp.as_user('00000000-0000-0000-0000-00000000c101');
create temp table slugs (k text primary key, slug text);
grant all on slugs to authenticated;
insert into slugs values ('pub', public.create_community('Founders in Cairo', 'Founders building in Cairo.', 'Location', '{Fundraising, Hiring, Fundraising, " "}', '{Founder}', 'public'));
insert into slugs values ('priv', public.create_community('Angel Circle', 'Angels sharing deal flow.', 'Role', '{Deal flow}', '{Angel Investor}', 'private'));
insert into ids select s.k, c.id from slugs s join public.communities c on c.slug = s.slug;
select pg_temp.check((select count(*) = 2 from ids), 'two communities created');
select pg_temp.check((select topics = '{Fundraising,Hiring}' from public.communities where id = (select v from ids where k = 'pub')), 'topics are trimmed and de-duplicated');
select pg_temp.check((select role = 'owner' from public.community_members where community_id = (select v from ids where k = 'pub') and member_id = auth.uid()), 'the creator is the owner');
select pg_temp.expect_error($$select public.create_community('X', 'Short name', 'Interest', '{}', '{}', 'public')$$, '%communities_name_check%', 'names need 3 characters');
select pg_temp.expect_error($$select public.create_community('Bad cover', 'd', 'Interest', '{}', '{}', 'public', 'https://evil.example/x.jpg')$$, '%bad_cover%', 'covers must be your own upload');
select pg_temp.expect_error($$select public.create_community('Bad type', 'd', 'Gossip', '{}', '{}', 'public')$$, '%communities_type_check%', 'types come from the list');
select pg_temp.check(public.create_community('Third one', 'd', 'Interest', '{}', '{}', 'public') like 'third-one-%', 'slugs come from the name');
select pg_temp.expect_error($$select public.create_community('Fourth one', 'd', 'Interest', '{}', '{}', 'public')$$, '%too_many_communities%', 'at most 3 new communities a day');
select pg_temp.expect_error($$insert into public.communities (slug, name, description, type, owner) values ('x-1', 'Direct', 'd', 'Other', auth.uid())$$, '%permission%', 'members cannot write communities directly');

-- Explore and join
select pg_temp.as_user('00000000-0000-0000-0000-00000000c102');
select pg_temp.check((select count(*) = 3 from public.list_communities('explore')), 'every member finds every active community');
select pg_temp.check(public.join_community((select v from ids where k = 'pub')) = 'active', 'Public communities join at once');
select pg_temp.check(public.join_community((select v from ids where k = 'priv')) = 'requested', 'Private communities take a request');
select pg_temp.check((select (c->>'can_see_inside')::boolean = false and c->>'my_status' = 'requested' from (select public.community_page((select slug from public.communities where id = (select v from ids where k = 'priv'))) c) x), 'a pending member cannot see inside a Private community');
select pg_temp.check((select count(*) = 0 from public.community_people((select v from ids where k = 'priv'))), 'a Private community''s members are hidden from outsiders');
select pg_temp.check((select count(*) = 2 from public.community_people((select v from ids where k = 'pub'))), 'a Public community''s members are visible');
select pg_temp.check((select count(*) = 1 from public.list_communities('joined') where my_status = 'active') and (select count(*) = 2 from public.list_communities('joined')), 'joined lists both, one waiting');
select pg_temp.expect_error($$select public.respond_join((select v from ids where k = 'priv'), auth.uid(), true)$$, '%not_allowed%', 'members cannot accept their own request');

-- The owner accepts, promotes and hands over
select pg_temp.as_user('00000000-0000-0000-0000-00000000c101');
select pg_temp.check((select count(*) = 1 from public.community_people((select v from ids where k = 'priv')) where status = 'requested'), 'owners see requests');
select public.respond_join((select v from ids where k = 'priv'), '00000000-0000-0000-0000-00000000c102', true);
select public.set_community_role((select v from ids where k = 'priv'), '00000000-0000-0000-0000-00000000c102', 'admin');
select pg_temp.expect_error($$select public.leave_community((select v from ids where k = 'priv'))$$, '%owner_must_transfer%', 'owners hand over before leaving');

select pg_temp.as_user('00000000-0000-0000-0000-00000000c102');
select pg_temp.check((select count(*) = 2 from public.notifications where text like '%Angel Circle accepted your request.' or text like '%now an admin of Angel Circle.'), 'the member hears they were accepted and made admin');
select pg_temp.check((select (c->>'can_see_inside')::boolean from (select public.community_page((select slug from public.communities where id = (select v from ids where k = 'priv'))) c) x), 'an active member sees inside');
-- An admin invites; an admin can't remove the owner
select pg_temp.check(public.invite_to_community((select v from ids where k = 'priv'), '00000000-0000-0000-0000-00000000c103') = 'invited', 'admins invite members');
select pg_temp.expect_error($$select public.remove_community_member((select v from ids where k = 'priv'), '00000000-0000-0000-0000-00000000c101')$$, '%not_allowed%', 'nobody removes the owner');
select pg_temp.expect_error($$select public.set_community_role((select v from ids where k = 'priv'), '00000000-0000-0000-0000-00000000c101', 'member')$$, '%not_found%', 'nobody demotes the owner');

select pg_temp.as_user('00000000-0000-0000-0000-00000000c103');
select pg_temp.check((select count(*) = 1 from public.list_communities('joined') where my_status = 'invited'), 'the invite shows for the invitee');
select pg_temp.check(public.join_community((select v from ids where k = 'priv')) = 'active', 'accepting an invite joins a Private community');
select pg_temp.expect_error($$select public.update_community((select v from ids where k = 'priv'), 'Hacked', 'd', 'Role', '{}', '{}', 'public')$$, '%not_allowed%', 'members cannot edit the community');
select public.leave_community((select v from ids where k = 'priv'));
select pg_temp.check((select count(*) = 0 from public.community_members where member_id = auth.uid() and community_id = (select v from ids where k = 'priv')), 'members can leave');

-- Transfer ownership
select pg_temp.as_user('00000000-0000-0000-0000-00000000c101');
select public.transfer_community((select v from ids where k = 'priv'), '00000000-0000-0000-0000-00000000c102');
select pg_temp.check((select owner = '00000000-0000-0000-0000-00000000c102' from public.communities where id = (select v from ids where k = 'priv'))
  and public.cm_role((select v from ids where k = 'priv'), '00000000-0000-0000-0000-00000000c101') = 'admin', 'ownership moves and the old owner stays as admin');
select pg_temp.expect_error($$select public.delete_community((select v from ids where k = 'priv'))$$, '%not_allowed%', 'only the owner deletes');

-- Archive by the team, report
select pg_temp.as_user('00000000-0000-0000-0000-00000000c103');
select pg_temp.check(public.report_content('community', (select v from ids where k = 'pub'), 'spam') is not null, 'members report a community');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000c109');
set local role authenticated;
select public.set_community_status((select v from ids where k = 'pub'), 'archived');
select pg_temp.as_user('00000000-0000-0000-0000-00000000c103');
select pg_temp.check((select count(*) = 0 from public.list_communities('explore') where id = (select v from ids where k = 'pub')), 'archived communities leave Explore');
select pg_temp.check(public.community_page((select slug from public.communities where id = (select v from ids where k = 'pub'))) is null, 'outsiders can''t open an archived community');
select pg_temp.as_user('00000000-0000-0000-0000-00000000c101');
select pg_temp.expect_error($$select public.set_community_status((select v from ids where k = 'pub'), 'active')$$, '%archived_by_team%', 'owners can''t restore what the team archived');

rollback;
