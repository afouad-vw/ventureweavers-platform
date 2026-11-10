-- Phase 10 tests: notifications written by triggers, members read only their own. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000ab', 'admin11@test', '{"name":"Admin Eleven"}'),
  ('00000000-0000-0000-0000-0000000000d7', 'n1@test', '{"name":"Nadia One"}'),
  ('00000000-0000-0000-0000-0000000000d8', 'n2@test', '{"name":"Nabil Two"}');
insert into public.admin_users (user_id, username, display_name) values ('00000000-0000-0000-0000-0000000000ab', 'admin.eleven', 'Admin Eleven');

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
create function pg_temp.latest(uid uuid) returns text language sql as $$
  select text from public.notifications where member_id = uid order by created_at desc, id desc limit 1 $$;

-- ---------------------------------------------------------------- seats (written as the database owner, like the booking functions)
insert into public.events (id, slug, title, type, starts_at, venue, capacity, price_piasters, status) values
  ('a0000000-0000-0000-0000-000000000001', 'notif-show', 'Notif show', 'public_show', now() + interval '5 days', 'Cairo', 20, 45000, 'published');
insert into public.bookings (id, event_id, member_id, seats, amount_piasters, status, pay_reference, hold_expires_at) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d7', 1, 45000, 'reserved', 'VWB-NOT001', now() + interval '1 day');
select pg_temp.check(pg_temp.latest('00000000-0000-0000-0000-0000000000d7') like 'Seat reserved for Notif show. Transfer EGP 450 by % with VWB-NOT001.', 'reservation notifies with amount, deadline and reference');
update public.bookings set status = 'confirmed' where id = 'a1000000-0000-0000-0000-000000000001';
select pg_temp.check(pg_temp.latest('00000000-0000-0000-0000-0000000000d7') = 'Your seat for Notif show is confirmed.', 'confirmed seat notifies');
update public.bookings set status = 'cancelled', closed_by = '00000000-0000-0000-0000-0000000000ab' where id = 'a1000000-0000-0000-0000-000000000001';
select pg_temp.check(pg_temp.latest('00000000-0000-0000-0000-0000000000d7') = 'Your booking for Notif show was cancelled.', 'cancellation by the hosts notifies');
insert into public.bookings (id, event_id, member_id, seats, amount_piasters, status, pay_reference, hold_expires_at) values
  ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d8', 1, 45000, 'reserved', 'VWB-NOT002', now() + interval '1 day');
update public.bookings set status = 'cancelled', closed_by = '00000000-0000-0000-0000-0000000000d8' where id = 'a1000000-0000-0000-0000-000000000002';
select pg_temp.check(pg_temp.latest('00000000-0000-0000-0000-0000000000d8') like 'Seat reserved%', 'cancelling your own reservation sends nothing');
insert into public.bookings (event_id, member_id, seats, amount_piasters, status, pay_reference) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d8', 1, 45000, 'confirmed', 'VWB-NOT003');

-- ---------------------------------------------------------------- programs
insert into public.programs (id, slug, name, status) values ('a2000000-0000-0000-0000-000000000001', 'notif-prog', 'NotifProg', 'in_development');
insert into public.program_interest (member_id, program_id) values ('00000000-0000-0000-0000-0000000000d7', 'a2000000-0000-0000-0000-000000000001');
update public.programs set status = 'open' where id = 'a2000000-0000-0000-0000-000000000001';
select pg_temp.check(pg_temp.latest('00000000-0000-0000-0000-0000000000d7') = 'NotifProg is now open for applications.', 'program opening notifies interested members');
select pg_temp.check(pg_temp.latest('00000000-0000-0000-0000-0000000000d8') not like 'NotifProg%', 'only interested members');
insert into public.applications (id, member_id, program_id, role, building) values ('a3000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d7', 'a2000000-0000-0000-0000-000000000001', 'Founder', 'A fintech for SMEs');
update public.applications set status = 'intro_call' where id = 'a3000000-0000-0000-0000-000000000001';
select pg_temp.check(pg_temp.latest('00000000-0000-0000-0000-0000000000d7') like 'Your NotifProg application moved to Intro call.%', 'intro call notifies');
insert into public.cohorts (id, program_id, label) values ('a4000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Cohort 9');
insert into public.enrolments (id, member_id, cohort_id, status, amount_piasters, pay_reference) values
  ('a5000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d7', 'a4000000-0000-0000-0000-000000000001', 'offered', 100000, 'VWT-NOT001');
select pg_temp.check(pg_temp.latest('00000000-0000-0000-0000-0000000000d7') = 'You''re offered a seat in NotifProg · Cohort 9.', 'seat offer notifies');
update public.enrolments set status = 'confirmed' where id = 'a5000000-0000-0000-0000-000000000001';
select pg_temp.check(pg_temp.latest('00000000-0000-0000-0000-0000000000d7') = 'You''re enrolled in NotifProg. The classroom is open.', 'enrolment notifies');
insert into public.modules (id, cohort_id, position, title, opens_at) values ('a6000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 1, 'Module 1', now() - interval '1 day');
insert into public.assignments (id, module_id, title) values ('a7000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'Market map');
insert into public.submissions (id, assignment_id, member_id, file_path, file_name, file_size) values ('a8000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d7', 'submissions/00000000-0000-0000-0000-0000000000d7/a8000000-0000-0000-0000-000000000009.pdf', 'map.pdf', 1000);
update public.submissions set status = 'reviewed' where id = 'a8000000-0000-0000-0000-000000000001';
select pg_temp.check(pg_temp.latest('00000000-0000-0000-0000-0000000000d7') = 'Your hand-in for Market map was reviewed.', 'review notifies');
update public.submissions set status = 'submitted' where id = 'a8000000-0000-0000-0000-000000000001';
select pg_temp.check(pg_temp.latest('00000000-0000-0000-0000-0000000000d7') like 'Your hand-in for Market map was reopened.%', 'reopen notifies');

-- ---------------------------------------------------------------- BRICKR meetings
insert into public.services (id, slug, name, space, status) values ('a9000000-0000-0000-0000-000000000001', 'notif-svc', 'Growth diagnostic', 'BRICKR', 'published');
insert into public.requests (id, member_id, service_id, preferred_at) values ('aa000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d8', 'a9000000-0000-0000-0000-000000000001', now() + interval '2 days');
update public.requests set meeting_at = '2026-11-17 09:30+00' where id = 'aa000000-0000-0000-0000-000000000001';
select pg_temp.check(pg_temp.latest('00000000-0000-0000-0000-0000000000d8') = 'Meeting confirmed: Growth diagnostic, Tue 17 Nov, 11:30 (Cairo).', 'meeting confirmation notifies in Cairo time');

-- ---------------------------------------------------------------- payment requests and live mode (as an admin)
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ab');
insert into public.payment_requests (member_id, item, amount_piasters) values ('00000000-0000-0000-0000-0000000000d8', 'Growth diagnostic', 1500050);
reset role;
select pg_temp.check(pg_temp.latest('00000000-0000-0000-0000-0000000000d8') = 'New payment request: Growth diagnostic, EGP 15,000.50.', 'payment request notifies with amount');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ab');
select public.admin_request_status((select id from public.payment_requests where item = 'Growth diagnostic' and member_id = '00000000-0000-0000-0000-0000000000d8'), 'paid');
select public.admin_live_open('a0000000-0000-0000-0000-000000000001', true);
reset role;
select pg_temp.check((select count(*) from public.notifications where text like 'Payment received for Growth diagnostic%') = 1, 'paid request notifies');
select pg_temp.check((select count(*) from public.notifications where text like 'Live mode is open for Notif show%') = 1, 'live mode notifies confirmed ticket holders only');
select pg_temp.check((select href from public.notifications where text like 'Live mode is open%') = '/live?event=a0000000-0000-0000-0000-000000000001', 'live notification links to the show');

-- ---------------------------------------------------------------- access
set local role anon;
select pg_temp.expect_error($$select * from public.notifications$$, '%permission denied%', 'visitors cannot read notifications');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d7');
select pg_temp.check((select count(*) from public.notifications) > 0 and (select bool_and(member_id = '00000000-0000-0000-0000-0000000000d7') from public.notifications), 'members see only their own notifications');
select pg_temp.expect_error($$insert into public.notifications (member_id, text) values ('00000000-0000-0000-0000-0000000000d7', 'fake')$$, '%permission denied%', 'members cannot create notifications');
select pg_temp.expect_error($$update public.notifications set text = 'changed'$$, '%permission denied%', 'members cannot change the text');
select pg_temp.expect_error($$select public.notify('00000000-0000-0000-0000-0000000000d8', 'spam', '/')$$, '%permission denied%', 'members cannot call notify');
update public.notifications set read_at = now() where read_at is null;
select pg_temp.check((select count(*) from public.notifications where read_at is null) = 0, 'members mark their notifications read');
update public.notifications set read_at = now() where member_id = '00000000-0000-0000-0000-0000000000d8';
reset role;
select pg_temp.check((select count(*) from public.notifications where member_id = '00000000-0000-0000-0000-0000000000d8' and read_at is not null) = 0, 'cannot mark someone else''s as read');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ab');
select pg_temp.check((select count(*) from public.notifications) = 0, 'admins don''t read members'' notifications');

rollback;
