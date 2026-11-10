-- Phase 14 tests: super admins, team members with area permissions, pausing and removing. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'super@test', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'requests@test', '{}'),
  ('00000000-0000-0000-0000-0000000000e3', 'door@test', '{}'),
  ('00000000-0000-0000-0000-0000000000e4', 'newbie@test', '{}'),
  ('00000000-0000-0000-0000-0000000000e5', 'member@test', '{"name":"Member Five"}');
insert into public.admin_users (user_id, username, display_name, is_super) values ('00000000-0000-0000-0000-0000000000e1', 'super.one', 'Super One', true);
insert into public.admin_users (user_id, username, display_name, permissions) values
  ('00000000-0000-0000-0000-0000000000e2', 'req.two', 'Req Two', '{requests.manage,contacts.view}'),
  ('00000000-0000-0000-0000-0000000000e3', 'door.three', 'Door Three', '{checkin.manage}');
insert into public.contacts (name, email) values ('Added Person', 'added@test.example');
insert into public.services (id, slug, name, space, status) values ('e0000000-0000-0000-0000-000000000001', 'team-svc', 'Team service', 'BRICKR', 'published');
insert into public.requests (member_id, service_id, preferred_at) values ('00000000-0000-0000-0000-0000000000e5', 'e0000000-0000-0000-0000-000000000001', now() + interval '2 days');
insert into public.payment_requests (member_id, item, amount_piasters) values ('00000000-0000-0000-0000-0000000000e5', 'Team test item', 10000);

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

-- ---------------------------------------------------------------- the rewrite left nothing on "any admin"
select pg_temp.check((select count(*) from pg_policies where coalesce(qual, '') || coalesce(with_check, '') ~ 'is_admin\(\)' and tablename <> 'site_settings') = 0, 'every admin policy now checks an area');

-- ---------------------------------------------------------------- requests manager
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select pg_temp.check(public.is_admin() and not public.is_super_admin(), 'a team member is an admin but not a super admin');
select pg_temp.check(public.has_perm('requests.view') and public.has_perm('requests.manage') and public.has_perm('contacts.view'), 'manage includes view');
select pg_temp.check(not public.has_perm('contacts.manage') and not public.has_perm('payments.view'), 'no rights beyond the ticked areas');
select pg_temp.check((select count(*) from public.requests where service_id = 'e0000000-0000-0000-0000-000000000001') = 1, 'requests manager sees requests');
update public.requests set status = 'intro_call' where service_id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.check((select status = 'intro_call' from public.requests where service_id = 'e0000000-0000-0000-0000-000000000001'), 'requests manager moves requests');
select pg_temp.check((select count(*) from public.contacts) >= 1, 'contacts view shows contacts');
select pg_temp.expect_error($$insert into public.contacts (name) values ('Nope')$$, '%row-level security%', 'contacts view cannot add contacts');
select pg_temp.check((select count(*) from public.payment_requests) = 0, 'requests manager cannot see payments');
select pg_temp.check((select count(*) from public.audit_log) = 0, 'only super admins read the audit log');
select pg_temp.check((select count(*) from public.site_settings) >= 1, 'team members read settings');
update public.site_settings set value = 'hacked' where key = 'bank_details';
select pg_temp.check((select value <> 'hacked' from public.site_settings where key = 'bank_details'), 'team members cannot change settings');
select pg_temp.expect_error($$select public.admin_update_member('00000000-0000-0000-0000-0000000000e5', 'X Y', '+20 1001234567', null, 'Egypt', 'Founder', array['Education'], array['Email'])$$, '%not_admin%', 'contacts view cannot edit member details');
select pg_temp.expect_error($$select public.admin_team_add('00000000-0000-0000-0000-0000000000e4', 'new.four', 'New Four', '{}')$$, '%not_super%', 'team members cannot add team members');
select pg_temp.expect_error($$update public.admin_users set is_super = true where user_id = '00000000-0000-0000-0000-0000000000e2'$$, '%permission denied%', 'team members cannot change admin rows');

-- ---------------------------------------------------------------- door staff
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
select pg_temp.check(public.admin_check_in('VW-XXXX-XXXX') ->> 'result' = 'not_found', 'door staff can check tickets');
select pg_temp.check((select count(*) from public.profiles where id <> '00000000-0000-0000-0000-0000000000e3') = 0, 'door staff cannot read member profiles');
select pg_temp.check((select count(*) from public.bookings) = 0 and (select count(*) from public.contacts) = 0 and (select count(*) from public.requests) = 0, 'door staff see no bookings, contacts or requests');
select pg_temp.expect_error($$select public.admin_mark_paid(gen_random_uuid())$$, '%forbidden%', 'door staff cannot mark payments');

-- ---------------------------------------------------------------- super admins manage the team
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check(public.is_super_admin() and public.has_perm('payments.manage'), 'super admins can do everything');
select public.admin_team_add('00000000-0000-0000-0000-0000000000e4', 'new.four', 'New Four', '{library.manage,settings.manage,library.manage}');
select pg_temp.check(public.admin_perm_list() @> array['library.manage'], 'permission list is known');
reset role;
select pg_temp.check((select permissions = '{library.manage}' and not is_super and added_by = '00000000-0000-0000-0000-0000000000e1' from public.admin_users where user_id = '00000000-0000-0000-0000-0000000000e4'), 'new team member gets only known permissions');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.expect_error($$select public.admin_team_add('00000000-0000-0000-0000-0000000000e5', 'new.four', 'Dup', '{}')$$, '%username_taken%', 'usernames are unique');
select pg_temp.expect_error($$select public.admin_team_update('00000000-0000-0000-0000-0000000000e1', 'Super', '{}')$$, '%not_team_member%', 'super admins cannot be changed from the Team page');
select public.admin_team_update('00000000-0000-0000-0000-0000000000e4', 'New Four', '{library.view,quidquo.manage}');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e4');
select pg_temp.check(public.has_perm('quidquo.manage') and public.has_perm('library.view') and not public.has_perm('library.manage'), 'access changes apply at once');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select public.admin_team_pause('00000000-0000-0000-0000-0000000000e4', true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e4');
select pg_temp.check(not public.is_admin() and not public.has_perm('quidquo.view'), 'a paused team member has no access');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select public.admin_team_pause('00000000-0000-0000-0000-0000000000e4', false);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e4');
select pg_temp.check(public.is_admin(), 'resuming restores access');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select public.admin_team_remove('00000000-0000-0000-0000-0000000000e4');
select pg_temp.expect_error($$select public.admin_team_remove('00000000-0000-0000-0000-0000000000e1')$$, '%not_team_member%', 'super admins cannot be removed');
reset role;
select pg_temp.check((select count(*) from public.admin_users where user_id = '00000000-0000-0000-0000-0000000000e4') = 0, 'removed team member is gone');
select pg_temp.check((select count(*) from public.audit_log where action like 'team.%') = 5, 'team changes are logged');

-- Nobody becomes a super admin from the app.
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
reset role;
select pg_temp.expect_error($$insert into public.admin_users (user_id, username, display_name, is_super) values ('00000000-0000-0000-0000-0000000000e5', 'promo.five', 'Promo', true)$$, '%super_admins_fixed%', 'super admins are fixed (no promotion from the app)');

rollback;
