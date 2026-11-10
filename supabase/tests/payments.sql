-- Phase 9 tests: payment requests, program seat refunds, the admin payments list. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000aa', 'admin10@test', '{"name":"Admin Ten"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test', '{"name":"Client One"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test', '{"name":"Client Two"}');
insert into public.admin_users (user_id, username, display_name) values ('00000000-0000-0000-0000-0000000000aa', 'admin.ten', 'Admin Ten');
update public.admin_users set is_super = true; -- test admins are super admins (Phase 14)
insert into public.events (id, slug, title, type, starts_at, venue, capacity, price_piasters, status) values
  ('90000000-0000-0000-0000-000000000001', 'pay-show', 'Pay show', 'public_show', now() + interval '5 days', 'Cairo', 20, 50000, 'published');
insert into public.bookings (event_id, member_id, seats, amount_piasters, status, pay_reference, hold_expires_at) values
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 2, 100000, 'reserved', 'VWB-PAY001', now() + interval '1 day'),
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c2', 1, 50000, 'reserved', 'VWB-PAY002', now() - interval '1 hour');
insert into public.programs (id, slug, name, status) values ('91000000-0000-0000-0000-000000000001', 'pay-prog', 'Pay program', 'open');
insert into public.cohorts (id, program_id, label) values ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Cohort 1');
insert into public.enrolments (id, member_id, cohort_id, status, amount_piasters, pay_reference) values
  ('93000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', '92000000-0000-0000-0000-000000000001', 'confirmed', 2000000, 'VWT-PAY001'),
  ('93000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c2', '92000000-0000-0000-0000-000000000001', 'offered', 2000000, 'VWT-PAY002');

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

-- ---------------------------------------------------------------- visitors and members
set local role anon;
select pg_temp.expect_error($$select * from public.payment_requests$$, '%permission denied%', 'visitors cannot read payment requests');
select pg_temp.expect_error($$select * from public.payments_ledger$$, '%permission denied%', 'visitors cannot read the payments list');

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($$insert into public.payment_requests (member_id, item, amount_piasters) values ('00000000-0000-0000-0000-0000000000c1', 'Self-made', 100)$$, '%row-level security%', 'members cannot create payment requests');
select pg_temp.check((select count(*) from public.payments_ledger) = 0, 'members see nothing in the payments list');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000ee', 'aal2');
select pg_temp.expect_error($$insert into public.payment_requests (member_id, item, amount_piasters) values ('00000000-0000-0000-0000-0000000000c1', 'No 2-step', 100)$$, '%row-level security%', '2-step users who are not admins cannot create requests');
select pg_temp.check((select count(*) from public.payments_ledger) = 0, '2-step users who are not admins see nothing in the list');

-- ---------------------------------------------------------------- admins create requests
select pg_temp.as_user('00000000-0000-0000-0000-0000000000aa', 'aal2');
insert into public.payment_requests (member_id, item, space, amount_piasters, due_on, note) values
  ('00000000-0000-0000-0000-0000000000c1', 'Growth diagnostic', 'BRICKR', 1500000, current_date + 7, 'Two-week engagement'),
  ('00000000-0000-0000-0000-0000000000c2', 'Private session', 'Outloud', 300000, null, '');
select pg_temp.check((select bool_and(reference ~ '^VWP-[2-9A-Z]{6}$' and status = 'pending' and created_by = '00000000-0000-0000-0000-0000000000aa') from public.payment_requests), 'requests get a VWP- reference, start pending, record who made them');
select pg_temp.expect_error($$insert into public.payment_requests (member_id, item, amount_piasters, status) values ('00000000-0000-0000-0000-0000000000c1', 'Sneaky', 100, 'paid')$$, '%permission denied%', 'cannot create a request as already paid');
select pg_temp.expect_error($$insert into public.payment_requests (member_id, item, amount_piasters) values ('00000000-0000-0000-0000-0000000000c1', 'Too small', 50)$$, '%check%', 'amount at least EGP 1');
select pg_temp.expect_error($$insert into public.payment_requests (member_id, item, amount_piasters) values ('00000000-0000-0000-0000-0000000000c1', 'Too big', 1000000001)$$, '%check%', 'amount at most EGP 10,000,000');
select pg_temp.expect_error($$insert into public.payment_requests (member_id, item, amount_piasters) values ('00000000-0000-0000-0000-0000000000c1', 'Negative', -500)$$, '%check%', 'no negative amounts');
select pg_temp.expect_error($$update public.payment_requests set status = 'paid'$$, '%permission denied%', 'status only changes through the functions');
update public.payment_requests set amount_piasters = 1600000 where item = 'Growth diagnostic';
select pg_temp.check((select amount_piasters from public.payment_requests where item = 'Growth diagnostic') = 1600000, 'pending requests can be edited');
create temp table req as select item, id from public.payment_requests;
grant select on req to authenticated;

-- ---------------------------------------------------------------- members see only their own
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select count(*) from public.payment_requests) = 1, 'members see only their own requests');
select pg_temp.check((select item from public.payment_requests) = 'Growth diagnostic', 'it is the right one');
update public.payment_requests set amount_piasters = 100;
select pg_temp.check((select amount_piasters from public.payment_requests) = 1600000, 'members cannot change amounts');
select pg_temp.expect_error($$select public.admin_request_status((select id from req where item = 'Growth diagnostic'), 'paid')$$, '%forbidden%', 'members cannot mark paid');

-- ---------------------------------------------------------------- status changes
select pg_temp.as_user('00000000-0000-0000-0000-0000000000aa', 'aal2');
select pg_temp.expect_error($$select public.admin_request_status((select id from req where item = 'Growth diagnostic'), 'refunded')$$, '%bad_transition%', 'cannot refund before it is paid');
select public.admin_request_status((select id from req where item = 'Growth diagnostic'), 'paid');
select pg_temp.check((select status = 'paid' and paid_at is not null and marked_by = '00000000-0000-0000-0000-0000000000aa' from public.payment_requests where item = 'Growth diagnostic'), 'mark paid records who and when');
select pg_temp.expect_error($$select public.admin_request_status((select id from req where item = 'Growth diagnostic'), 'paid')$$, '%bad_transition%', 'cannot mark paid twice');
select pg_temp.expect_error($$select public.admin_request_status((select id from req where item = 'Growth diagnostic'), 'cancelled')$$, '%bad_transition%', 'paid requests are refunded, not cancelled');
select pg_temp.expect_error($$update public.payment_requests set amount_piasters = 100 where item = 'Growth diagnostic'$$, '%not_editable%', 'paid requests cannot be edited');
select pg_temp.expect_error($$delete from public.payment_requests where item = 'Growth diagnostic'$$, '%keep_money_records%', 'paid requests cannot be deleted');
select public.admin_request_status((select id from req where item = 'Growth diagnostic'), 'refunded');
select pg_temp.check((select status from public.payment_requests where item = 'Growth diagnostic') = 'refunded', 'full refund recorded');
select public.admin_request_status((select id from req where item = 'Private session'), 'cancelled');
select pg_temp.expect_error($$select public.admin_request_status((select id from req where item = 'Private session'), 'paid')$$, '%bad_transition%', 'cancelled requests cannot be paid');
select pg_temp.check((select count(*) from public.audit_log where entity = 'payment_requests') = 3, 'every status change is audited');

-- ---------------------------------------------------------------- program seat refunds
select pg_temp.expect_error($$select public.admin_refund_enrolment('93000000-0000-0000-0000-000000000002')$$, '%bad_transition%', 'only paid program seats can be refunded');
select public.admin_refund_enrolment('93000000-0000-0000-0000-000000000001');
select pg_temp.check((select status = 'cancelled' and refunded_at is not null from public.enrolments where id = '93000000-0000-0000-0000-000000000001'), 'program seat refunded');

-- ---------------------------------------------------------------- the payments list
select pg_temp.check((select count(*) from public.payments_ledger where reference like '%PAY%' or reference like 'VWP-%') = 6, 'list holds seats, program seats and requests');
select pg_temp.check((select status from public.payments_ledger where reference = 'VWB-PAY001') = 'pending', 'live reservation shows as pending');
select pg_temp.check((select status from public.payments_ledger where reference = 'VWB-PAY002') = 'expired', 'lapsed reservation shows as expired');
select pg_temp.check((select status from public.payments_ledger where reference = 'VWT-PAY001') = 'refunded', 'refunded program seat shows as refunded');
select pg_temp.check((select status from public.payments_ledger where reference = 'VWT-PAY002') = 'pending', 'offered program seat shows as pending');
select pg_temp.check((select item from public.payments_ledger where reference = 'VWB-PAY001') = 'Pay show · 2 seats', 'seat item names the show and seats');
select pg_temp.check((select space from public.payments_ledger where kind = 'program' limit 1) = 'TVS', 'program seats are TVS');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($$select public.admin_refund_enrolment('93000000-0000-0000-0000-000000000002')$$, '%forbidden%', 'members cannot refund');

rollback;
