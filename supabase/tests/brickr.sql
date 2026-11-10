-- Phase 7 tests: services, requests, partner notes, QuidQuo stages, build log, waitlist, Library levels. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a8', 'admin8@test', '{"name":"Admin Eight"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'f1@test', '{"name":"Founder F1"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@test', '{"name":"Founder F2"}');
insert into public.admin_users (user_id, username, display_name) values ('00000000-0000-0000-0000-0000000000a8', 'admin.eight', 'Admin Eight');
update public.admin_users set is_super = true; -- test admins are super admins (Phase 14)

insert into public.services (id, slug, name, space, status) values
  ('60000000-0000-0000-0000-000000000001', 'diagnostic', 'Growth diagnostic', 'BRICKR', 'published'),
  ('60000000-0000-0000-0000-000000000002', 'private', 'Open Floor private session', 'Outloud', 'published'),
  ('60000000-0000-0000-0000-000000000003', 'secret', 'Secret service', 'BRICKR', 'draft');
insert into public.qq_stages (position, name, progress) values (1, 'Research', 100), (2, 'Prototype', 60);
insert into public.qq_log (title, status) values ('Published entry', 'published'), ('Draft entry', 'draft');

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
create function pg_temp.as_user(uid text, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'aal', aal, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(text, text) to anon, authenticated;

-- ---------------------------------------------------------------- visitors
set local role anon;
select set_config('request.jwt.claims', '', true);
select pg_temp.check((select count(*) from public.services where slug <> 'custom-program') = 2, 'visitors see published services only');
select pg_temp.check((select count(*) from public.qq_stages) = 2, 'visitors see QuidQuo stages');
select pg_temp.check((select count(*) from public.qq_log) = 1, 'visitors see the published build log only');
select pg_temp.expect_error($$select count(*) from public.requests$$, '%permission denied%', 'visitors cannot read requests');
select pg_temp.expect_error($$select count(*) from public.waitlist$$, '%permission denied%', 'visitors cannot read the waitlist');
select pg_temp.expect_error($$select public.join_waitlist('Investor or angel', true)$$, '%permission denied%', 'visitors cannot join the waitlist');

-- ---------------------------------------------------------------- member F1
reset role; set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
insert into public.requests (service_id, preferred_at, company, note) values ('60000000-0000-0000-0000-000000000002', now() + interval '2 days', 'Acme', 'Team offsite');
select pg_temp.check((select space from public.requests) = 'Outloud', 'the space comes from the service');
select pg_temp.check((select status from public.requests) = 'new', 'requests start as New');
select pg_temp.expect_error($$insert into public.requests (service_id, preferred_at) values ('60000000-0000-0000-0000-000000000003', now() + interval '2 days')$$, '%service_closed%', 'no requests for draft services');
select pg_temp.expect_error($$insert into public.requests (service_id, preferred_at) values ('60000000-0000-0000-0000-000000000001', now() - interval '1 hour')$$, '%bad_time%', 'no times in the past');
select pg_temp.expect_error($$insert into public.requests (service_id, preferred_at) values ('60000000-0000-0000-0000-000000000001', now() + interval '60 days')$$, '%bad_time%', 'no times more than 30 days out');
select pg_temp.expect_error($$insert into public.requests (service_id, preferred_at, status) values ('60000000-0000-0000-0000-000000000001', now() + interval '1 day', 'won')$$, '%permission denied%', 'members cannot set the stage');
select pg_temp.expect_error($$insert into public.requests (service_id, preferred_at, member_id) values ('60000000-0000-0000-0000-000000000001', now() + interval '1 day', '00000000-0000-0000-0000-0000000000f2')$$, '%permission denied%', 'members cannot request for someone else');
insert into public.requests (service_id, preferred_at) select '60000000-0000-0000-0000-000000000001', now() + interval '1 day' from generate_series(1, 4);
select pg_temp.expect_error($$insert into public.requests (service_id, preferred_at) values ('60000000-0000-0000-0000-000000000001', now() + interval '1 day')$$, '%too_many_open%', 'at most 5 open requests');
update public.requests set status = 'won';
select pg_temp.check((select count(*) from public.requests where status = 'won') = 0, 'members cannot move their requests');
select pg_temp.expect_error($$update public.requests set note = 'changed'$$, '%permission denied%', 'members cannot edit after sending');
select pg_temp.check((select count(*) from public.request_notes) = 0, 'members see no partner notes');
select pg_temp.check(not ('brickr_clients' = any (public.my_access_levels())), 'not a BRICKR client yet');

-- waitlist
select pg_temp.check(public.join_waitlist('Founder raising capital', true) ~ '^[2-9A-Z]{8}$', 'member joins the waitlist and gets an invite code');
select pg_temp.check('quidquo_waitlist' = any (public.my_access_levels()), 'waitlist members hold the QuidQuo waitlist level');
select public.join_waitlist('Investor or angel', false);
select pg_temp.check((select role from public.waitlist) = 'Investor or angel', 'joining again updates the entry');
select pg_temp.check((select count(*) from public.waitlist) = 1, 'one entry per member');
select pg_temp.expect_error($$select public.join_waitlist('Astronaut', true)$$, '%bad_role%', 'only known roles');
select pg_temp.expect_error($$insert into public.waitlist (role, email) values ('Investor or angel', 'x@y.com')$$, '%row-level security%', 'members cannot add other people');

-- ---------------------------------------------------------------- member F2 joins through F1's invite
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select pg_temp.check((select count(*) from public.requests) = 0, 'members do not see others'' requests');
select pg_temp.check((select count(*) from public.waitlist) = 0, 'members do not see others on the waitlist');
select public.join_waitlist('Founder raising capital', true, (select invite_code from public.waitlist where member_id = '00000000-0000-0000-0000-0000000000f1'));
reset role;
select pg_temp.check((select invited_by from public.waitlist where member_id = '00000000-0000-0000-0000-0000000000f2') = (select id from public.waitlist where member_id = '00000000-0000-0000-0000-0000000000f1'), 'invites are recorded');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
insert into public.requests (service_id, preferred_at) values ('60000000-0000-0000-0000-000000000001', now() + interval '3 days');
delete from public.requests;
select pg_temp.check((select count(*) from public.requests) = 0, 'members withdraw their own new requests');
insert into public.requests (service_id, preferred_at) values ('60000000-0000-0000-0000-000000000001', now() + interval '3 days');
delete from public.waitlist;
select pg_temp.check(not ('quidquo_waitlist' = any (public.my_access_levels())), 'leaving the waitlist removes the level');

-- ---------------------------------------------------------------- admins
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ee', 'aal2');
select pg_temp.check((select count(*) from public.requests) = 0, '2-step users who are not admins see no requests');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a8', 'aal2');
select pg_temp.check((select count(*) from public.requests) = 6, 'admins see every request');
select pg_temp.check((select count(*) from public.services where slug <> 'custom-program') = 3, 'admins see draft services');
update public.requests set status = 'won', owner = 'Karim', meeting_at = now() + interval '1 day', meeting_url = 'https://meet.google.com/abc-defg-hij'
  where member_id = '00000000-0000-0000-0000-0000000000f2';
insert into public.request_notes (request_id, body) select id, 'Strong team; needs pricing help.' from public.requests where member_id = '00000000-0000-0000-0000-0000000000f2';
select pg_temp.check((select count(*) from public.request_notes) = 1, 'admins write partner notes');
select pg_temp.expect_error($$insert into public.request_notes (request_id, body, author_id) select id, 'x', '00000000-0000-0000-0000-0000000000f1' from public.requests limit 1$$, '%row-level security%', 'notes record the real author');
select pg_temp.expect_error($$update public.requests set meeting_url = 'javascript:alert(1)'$$, '%meeting_url_check%', 'Meet links must be https');
insert into public.waitlist (name, email, role) values ('Omar Saleh', 'omar@example.com', 'Investor or angel');
select pg_temp.check((select count(*) from public.waitlist) = 2, 'admins add people and see the waitlist');
select pg_temp.expect_error($$insert into public.waitlist (name, email, role) values ('Omar again', 'OMAR@example.com', 'Investor or angel')$$, '%waitlist_email_idx%', 'no duplicate emails');
insert into public.qq_stages (position, name) values (3, 'Private beta');
update public.qq_log set status = 'published';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select pg_temp.check((select meeting_url from public.requests) = 'https://meet.google.com/abc-defg-hij', 'members see the confirmed meeting link');
select pg_temp.check((select count(*) from public.request_notes) = 0, 'members never see partner notes');
select pg_temp.check('brickr_clients' = any (public.my_access_levels()), 'a Won request makes a BRICKR client');
delete from public.requests;
select pg_temp.check((select count(*) from public.requests) = 1, 'members cannot withdraw a request once it moved on');
select pg_temp.expect_error($$insert into public.services (slug, name) values ('x', 'Hack')$$, '%row-level security%', 'members cannot add services');
select pg_temp.expect_error($$insert into public.qq_stages (name) values ('Hack')$$, '%row-level security%', 'members cannot add stages');

rollback;
