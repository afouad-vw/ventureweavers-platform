-- Access tests. Run with: npm run test:db  (needs a throwaway Postgres; see scripts/test-db.sh)
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test', '{"name":"Admin One"}'),
  ('00000000-0000-0000-0000-00000000000b', 'member@test', '{"full_name":"Member B","picture":"https://x/p.jpg"}'),
  ('00000000-0000-0000-0000-00000000000c', 'other@test', '{}');
insert into public.admin_users (user_id, username, display_name)
  values ('00000000-0000-0000-0000-00000000000a', 'admin.one', 'Admin One');
update public.admin_users set is_super = true; -- test admins are super admins (Phase 14)

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', label; end if;
  raise notice 'ok - %', label;
end $$;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated;

-- profiles created from sign-up metadata
select pg_temp.check((select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'Member B', 'profile gets name from metadata');
select pg_temp.check((select avatar_url from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'https://x/p.jpg', 'profile gets picture from metadata');

-- ---------- anonymous
set local role anon;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform 1 from public.profiles; raise exception 'FAIL: anon can read profiles';
exception when insufficient_privilege then raise notice 'ok - anon cannot read profiles'; end $$;
do $$ begin
  perform 1 from public.admin_users; raise exception 'FAIL: anon can read admin_users';
exception when insufficient_privilege then raise notice 'ok - anon cannot read admin_users'; end $$;
select pg_temp.check(not public.is_admin(), 'anon is not admin');

-- ---------- member B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","aal":"aal1","role":"authenticated"}', true);
select pg_temp.check((select count(*) from public.profiles) = 1, 'member sees only own profile');
update public.profiles set full_name = 'Changed' where id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check((select count(*) from public.profiles where full_name = 'Changed') = 0, 'member cannot update another profile');
update public.profiles set phone = '+20100' where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.check((select phone from public.profiles) = '+20100', 'member can update own profile');
do $$ begin
  update public.profiles set id = '00000000-0000-0000-0000-00000000000c' where id = '00000000-0000-0000-0000-00000000000b';
  raise exception 'FAIL: member moved their profile to another id';
exception when others then raise notice 'ok - member cannot take over another id'; end $$;
do $$ begin
  insert into public.profiles (id) values (gen_random_uuid()); raise exception 'FAIL: member inserted a profile';
exception when insufficient_privilege then raise notice 'ok - member cannot insert profiles'; end $$;
do $$ begin
  perform 1 from public.admin_users; raise exception 'FAIL: member can read admin_users';
exception when insufficient_privilege then raise notice 'ok - member cannot read admin_users'; end $$;
do $$ begin
  insert into public.admin_users values ('00000000-0000-0000-0000-00000000000b', 'sneaky', 'x'); raise exception 'FAIL: member made themselves admin';
exception when insufficient_privilege then raise notice 'ok - member cannot add an admin'; end $$;
do $$ begin
  insert into public.audit_log (action, entity) values ('x', 'y'); raise exception 'FAIL: member wrote audit log';
exception when insufficient_privilege then raise notice 'ok - member cannot write audit log'; end $$;
select pg_temp.check((select count(*) from public.audit_log) = 0, 'member cannot read audit log');
select pg_temp.check(not public.is_admin(), 'member is not admin');

-- ---------- member B claiming aal2 is still not admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","aal":"aal2"}', true);
select pg_temp.check(not public.is_admin(), 'member with 2-step is still not admin');

-- ---------- admin signed in with password only (2-step removed in Phase 10)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","aal":"aal1"}', true);
select pg_temp.check(public.is_admin(), 'listed admin is admin without 2-step');
select pg_temp.check((select count(*) from public.profiles) > 1, 'admin reads all profiles');
-- ---------- someone not in admin_users is never admin, 2-step or not
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ee","aal":"aal2"}', true);
select pg_temp.check(not public.is_admin(), 'unlisted user with 2-step is not admin');

-- ---------- admin with 2-step
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', true);
select pg_temp.check(public.is_admin(), 'admin with 2-step is admin');
select pg_temp.check((select count(*) from public.profiles) = 3, 'admin sees all profiles');
do $$ begin
  perform 1 from public.admin_users; raise exception 'FAIL: admin_users readable from the browser';
exception when insufficient_privilege then raise notice 'ok - admin_users is server-only even for admins'; end $$;

-- ---------- server (service role)
reset role;
set local role service_role;
insert into public.audit_log (actor, action, entity) values ('00000000-0000-0000-0000-00000000000a', 'test', 'profiles');
do $$ begin
  update public.audit_log set action = 'edited'; raise exception 'FAIL: audit log edited';
exception when raise_exception or insufficient_privilege then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - audit log cannot be edited';
end $$;
do $$ begin
  delete from public.audit_log; raise exception 'FAIL: audit log deleted';
exception when raise_exception or insufficient_privilege then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - audit log cannot be deleted';
end $$;

-- ---------- even the table owner cannot edit the audit log (trigger)
reset role;
do $$ begin
  update public.audit_log set action = 'edited'; raise exception 'FAIL: owner edited audit log';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - audit log trigger blocks the owner too';
end $$;

-- ---------- admin reads audit log
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', true);
select pg_temp.check((select count(*) from public.audit_log) = 1, 'admin reads audit log');

rollback;
\echo ALL ACCESS TESTS PASSED
