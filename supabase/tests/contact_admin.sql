-- Phase 13 tests: partners edit member details, suspend accounts, log password resets. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'member.d1@test', '{"name":"Dee One"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'member.d2@test', '{"name":"Dee Two"}'),
  ('00000000-0000-0000-0000-0000000000da', 'admin.da@test', '{"name":"Admin Da"}');
insert into public.admin_users (user_id, username, display_name) values ('00000000-0000-0000-0000-0000000000da', 'admin.da', 'Admin Da');
update public.admin_users set is_super = true; -- test admins are super admins (Phase 14)
insert into auth.sessions (user_id) values ('00000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000d1');

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

-- ---------------------------------------------------------------- edit details
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select pg_temp.expect_error($$select public.admin_update_member('00000000-0000-0000-0000-0000000000d1', 'Hacked', '+20 1001234567', null, 'Egypt', 'Founder', array['Education'], array['Email'])$$, '%not_admin%', 'members cannot edit other members through the admin function');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000da');
select public.admin_update_member('00000000-0000-0000-0000-0000000000d1', 'Dee Updated', '+20 1001234567', 'https://www.linkedin.com/in/dee', 'Egypt', 'Founder', array['Education', 'QuidQuo'], array['WhatsApp', 'Email']);
reset role;
select pg_temp.check((select full_name = 'Dee Updated' and phone = '+20 1001234567' and consent_whatsapp and cardinality(goals) = 2 from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'), 'admins edit member details');
select pg_temp.check((select count(*) from public.audit_log where action = 'member.update' and entity_id = '00000000-0000-0000-0000-0000000000d1' and before ->> 'full_name' is distinct from after ->> 'full_name') = 1, 'every edit is logged with before and after');
select pg_temp.check((select count(*) from public.notifications where member_id = '00000000-0000-0000-0000-0000000000d1' and text like 'Your profile details were updated%') = 1, 'the member is told in their bell');

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000da');
select public.admin_update_member('00000000-0000-0000-0000-0000000000d1', 'Dee Updated', '+20 1001234567', 'https://www.linkedin.com/in/dee', 'Egypt', 'Founder', array['Education', 'QuidQuo'], array['WhatsApp', 'Email']);
reset role;
select pg_temp.check((select count(*) from public.audit_log where action = 'member.update' and entity_id = '00000000-0000-0000-0000-0000000000d1') = 1, 'saving without changes logs nothing');

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000da');
select pg_temp.expect_error($$select public.admin_update_member('00000000-0000-0000-0000-0000000000d1', 'Dee', '01001234567', null, 'Egypt', 'Founder', array['Education'], array['Email'])$$, '%bad_phone%', 'mobile must be in international format');
select pg_temp.expect_error($$select public.admin_update_member('00000000-0000-0000-0000-0000000000d1', 'Dee', '+20 1001234567', 'https://evil.example/x', 'Egypt', 'Founder', array['Education'], array['Email'])$$, '%check%', 'LinkedIn must be a linkedin.com link');
select pg_temp.expect_error($$select public.admin_update_member('00000000-0000-0000-0000-0000000000d1', 'Dee', '+20 1001234567', null, 'Egypt', 'Founder', array['Gold'], array['Email'])$$, '%bad_interests%', 'interests come from the list');
select pg_temp.expect_error($$select public.admin_update_member('00000000-0000-0000-0000-0000000000da', 'Admin', '+20 1001234567', null, 'Egypt', 'Founder', array['Education'], array['Email'])$$, '%admin_account%', 'admin accounts cannot be edited from Contacts');

-- ---------------------------------------------------------------- suspend / lift
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select pg_temp.expect_error($$select public.admin_set_suspension('00000000-0000-0000-0000-0000000000d1', true, 'x')$$, '%not_admin%', 'members cannot suspend anyone');
select pg_temp.check((select count(*) from public.member_suspensions) = 0, 'members see no suspensions');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000da');
select public.admin_set_suspension('00000000-0000-0000-0000-0000000000d1', true, 'Spam in Live mode');
select pg_temp.check((select count(*) from public.member_suspensions where member_id = '00000000-0000-0000-0000-0000000000d1') = 1, 'admins suspend a member');
select pg_temp.expect_error($$select public.admin_set_suspension('00000000-0000-0000-0000-0000000000da', true, '')$$, '%admin_account%', 'admin accounts cannot be suspended');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.check(public.am_i_suspended(), 'a suspended member is told they are suspended');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select pg_temp.check(not public.am_i_suspended(), 'others are not');
reset role;
select pg_temp.check((select count(*) from auth.sessions where user_id = '00000000-0000-0000-0000-0000000000d1') = 0, 'suspending signs the member out everywhere');
select pg_temp.check((select count(*) from public.audit_log where action = 'member.suspend' and after ->> 'reason' = 'Spam in Live mode') = 1, 'suspension is logged with the reason');

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000da');
select public.admin_set_suspension('00000000-0000-0000-0000-0000000000d1', false);
select pg_temp.check((select count(*) from public.member_suspensions) = 0, 'admins lift a suspension');
reset role;
select pg_temp.check((select count(*) from public.audit_log where action = 'member.unsuspend') = 1, 'lifting is logged');

-- ---------------------------------------------------------------- password resets
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select pg_temp.expect_error($$select public.admin_log_password_reset('00000000-0000-0000-0000-0000000000d1')$$, '%not_admin%', 'members cannot send resets for others');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000da');
select public.admin_log_password_reset('00000000-0000-0000-0000-0000000000d1') from generate_series(1, 3);
select pg_temp.expect_error($$select public.admin_log_password_reset('00000000-0000-0000-0000-0000000000d1')$$, '%too_many_resets%', 'at most 3 resets per member per hour');
select pg_temp.expect_error($$select public.admin_log_password_reset('00000000-0000-0000-0000-0000000000da')$$, '%admin_account%', 'no resets for admin accounts from Contacts');
reset role;

rollback;
