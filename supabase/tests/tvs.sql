-- Phase 6a tests: programs, Notify me, applications, cohorts, enrolments, masterclass links. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a6', 'admin6@test', '{"name":"Admin Six"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'd1@test', '{"name":"Learner D1"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'd2@test', '{"name":"Member D2"}'),
  ('00000000-0000-0000-0000-0000000000d3', 'd3@test', '{"name":"Member D3"}');
insert into public.admin_users (user_id, username, display_name) values ('00000000-0000-0000-0000-0000000000a6', 'admin.six', 'Admin Six');
update public.admin_users set is_super = true; -- test admins are super admins (Phase 14)

insert into public.programs (id, slug, name, kind, status, price_piasters) values
  ('40000000-0000-0000-0000-000000000001', 'tvac', 'TVAC', 'Foundation', 'open', 500000),
  ('40000000-0000-0000-0000-000000000002', 'angel360', 'Angel360', '360 program', 'in_development', null),
  ('40000000-0000-0000-0000-000000000003', 'secret', 'Secret', '360 program', 'draft', null);
insert into public.cohorts (id, program_id, capacity) values
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 2),
  ('41000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', null);
insert into public.events (id, slug, title, type, space, format, starts_at, capacity, price_piasters, status) values
  ('42000000-0000-0000-0000-000000000001', 'mc-1', 'Unit economics', 'masterclass', 'TVS', 'Online', now() + interval '20 days', 40, 0, 'published');
insert into public.event_links (event_id, meet_url) values ('42000000-0000-0000-0000-000000000001', 'https://meet.google.com/abc-defg-hij');

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
select pg_temp.check((select count(*) from public.programs) = 2, 'visitors see open and in-development programs, not drafts');
select pg_temp.check((select count(*) from public.events where type = 'masterclass') = 1, 'visitors see published masterclasses');
select pg_temp.expect_error($$select count(*) from public.event_links$$, '%permission denied%', 'visitors cannot read Meet links');
select pg_temp.expect_error($$select count(*) from public.applications$$, '%permission denied%', 'visitors cannot read applications');
select pg_temp.expect_error($$insert into public.applications (program_id, role, building) values ('40000000-0000-0000-0000-000000000001', 'Founder', 'A payments product for clinics')$$, '%permission denied%', 'visitors cannot apply');

-- ---------------------------------------------------------------- member D1 applies
reset role; set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
insert into public.applications (program_id, role, venture_stage, building, why_now)
  values ('40000000-0000-0000-0000-000000000001', 'Founder', 'Seed', 'A payments product for clinics in Cairo', 'Raising next year');
select pg_temp.check((select count(*) from public.applications) = 1, 'member sees their application');
select pg_temp.check((select status from public.applications) = 'new', 'new applications start as New');
select pg_temp.expect_error($$insert into public.applications (program_id, role, building) values ('40000000-0000-0000-0000-000000000001', 'Founder', 'Second try at the same program')$$, '%applications_one_open%', 'one open application per program');
select pg_temp.expect_error($$insert into public.applications (program_id, role, building) values ('40000000-0000-0000-0000-000000000002', 'Angel', 'I want to back founders early')$$, '%program_closed%', 'cannot apply to a program in development');
select pg_temp.expect_error($$insert into public.applications (program_id, role, building, status) values ('40000000-0000-0000-0000-000000000001', 'Founder', 'Skipping the queue please', 'won')$$, '%permission denied%', 'member cannot set the stage');
select pg_temp.expect_error($$insert into public.applications (program_id, role, building, answers) values ('40000000-0000-0000-0000-000000000001', 'Founder', 'short', '{"not":"a list"}')$$, '%answers_check%', 'application answers must be a list of questions and answers (Phase 14)');
update public.applications set status = 'won';
select pg_temp.check((select status from public.applications) = 'new', 'member cannot move their own application');
select pg_temp.expect_error($$update public.applications set building = 'Changed it'$$, '%permission denied%', 'member cannot edit after sending');
select pg_temp.expect_error($$select public.admin_offer_seat((select id from public.applications), '41000000-0000-0000-0000-000000000001', 0)$$, '%forbidden%', 'member cannot offer themselves a seat');

-- Notify me
insert into public.program_interest (program_id) values ('40000000-0000-0000-0000-000000000002');
select pg_temp.check((select count(*) from public.program_interest) = 1, 'member turns on Notify me');
select pg_temp.expect_error($$insert into public.program_interest (program_id, member_id) values ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000d2')$$, '%permission denied%', 'Notify me only for yourself');
select pg_temp.check((select count(*) from public.cohorts) = 0, 'members do not see cohorts before an offer');
select pg_temp.check(not ('tvs_learners' = any (public.my_access_levels())), 'applicants are not TVS learners yet');

-- Meet link before having a ticket
select pg_temp.check((select count(*) from public.event_links) = 0, 'no Meet link without a ticket');
select public.book_event('42000000-0000-0000-0000-000000000001', 1);
select pg_temp.check((select meet_url from public.event_links) = 'https://meet.google.com/abc-defg-hij', 'confirmed ticket holders read the Meet link');

-- ---------------------------------------------------------------- other members
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select pg_temp.check((select count(*) from public.applications) = 0, 'members do not see others'' applications');
select pg_temp.check((select count(*) from public.program_interest) = 0, 'members do not see others'' Notify me');
select pg_temp.check((select count(*) from public.event_links) = 0, 'members without a ticket see no Meet link');
insert into public.applications (program_id, role, building) values ('40000000-0000-0000-0000-000000000001', 'Operator', 'Building a logistics venture inside a corporate');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000d3');
insert into public.applications (program_id, role, building) values ('40000000-0000-0000-0000-000000000001', 'Founder', 'Climate venture for agriculture in Upper Egypt');

-- ---------------------------------------------------------------- a 2-step user who is not an admin
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ee', 'aal2');
select pg_temp.expect_error($$select public.admin_offer_seat((select id from public.applications limit 1), '41000000-0000-0000-0000-000000000001', 0)$$, '%forbidden%', 'a 2-step user who is not an admin cannot offer seats');

-- ---------------------------------------------------------------- admin
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6', 'aal2');
select pg_temp.check((select count(*) from public.programs) = 3, 'admins see draft programs');
select pg_temp.check((select count(*) from public.applications) = 3, 'admins see every application');
select pg_temp.check((select count(*) from public.program_interest) = 1, 'admins see who asked to be notified');
update public.applications set status = 'intro_call', owner = 'Karim' where member_id = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.check((select status from public.applications where member_id = '00000000-0000-0000-0000-0000000000d1') = 'intro_call', 'admins move applications');

-- paid offer for D1
select public.admin_offer_seat((select id from public.applications where member_id = '00000000-0000-0000-0000-0000000000d1'), '41000000-0000-0000-0000-000000000001', 500000);
select pg_temp.check((select status from public.applications where member_id = '00000000-0000-0000-0000-0000000000d1') = 'won', 'an offer moves the application to Won');
select pg_temp.check((select status from public.enrolments where member_id = '00000000-0000-0000-0000-0000000000d1') = 'offered', 'paid seat waits for payment');
select pg_temp.check((select pay_reference from public.enrolments where member_id = '00000000-0000-0000-0000-0000000000d1') ~ '^VWT-[2-9A-Z]{6}$', 'enrolment gets a payment reference');
select pg_temp.expect_error($$select public.admin_offer_seat((select id from public.applications where member_id = '00000000-0000-0000-0000-0000000000d1'), '41000000-0000-0000-0000-000000000001', 500000)$$, '%already_enrolled%', 'no double offers');
select pg_temp.expect_error($$select public.admin_offer_seat((select id from public.applications where member_id = '00000000-0000-0000-0000-0000000000d2'), '41000000-0000-0000-0000-000000000002', 0)$$, '%wrong_program%', 'offer must be in the program applied to');
select pg_temp.expect_error($$select public.admin_offer_seat((select id from public.applications where member_id = '00000000-0000-0000-0000-0000000000d2'), '41000000-0000-0000-0000-000000000001', -1)$$, '%bad_amount%', 'no negative amounts');
-- sponsored seat for D2 confirms at once
select public.admin_offer_seat((select id from public.applications where member_id = '00000000-0000-0000-0000-0000000000d2'), '41000000-0000-0000-0000-000000000001', 0);
select pg_temp.check((select status from public.enrolments where member_id = '00000000-0000-0000-0000-0000000000d2') = 'confirmed', 'a sponsored seat is confirmed straight away');
-- capacity 2 is now full
select pg_temp.expect_error($$select public.admin_offer_seat((select id from public.applications where member_id = '00000000-0000-0000-0000-0000000000d3'), '41000000-0000-0000-0000-000000000001', 500000)$$, '%cohort_full%', 'cohort capacity is respected');
update public.applications set status = 'declined' where member_id = '00000000-0000-0000-0000-0000000000d3';
select pg_temp.expect_error($$select public.admin_offer_seat((select id from public.applications where member_id = '00000000-0000-0000-0000-0000000000d3'), '41000000-0000-0000-0000-000000000001', 0)$$, '%declined%', 'no offers on declined applications');

-- ---------------------------------------------------------------- D1 before and after paying
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.check((select count(*) from public.enrolments) = 1, 'learner sees their enrolment');
select pg_temp.check((select count(*) from public.cohorts) = 1, 'learner sees the cohort they were offered');
select pg_temp.check(not ('tvs_learners' = any (public.my_access_levels())), 'offered but unpaid is not a TVS learner');
select pg_temp.expect_error($$select public.admin_confirm_enrolment((select id from public.enrolments))$$, '%forbidden%', 'learner cannot mark themselves paid');
select pg_temp.expect_error($$update public.enrolments set status = 'confirmed'$$, '%permission denied%', 'learner cannot change their enrolment');
-- Library learner level stays locked
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select pg_temp.check('tvs_learners' = any (public.my_access_levels()), 'a confirmed learner holds the TVS learners level');
select pg_temp.check((select count(*) from public.enrolments) = 1, 'each learner sees only their own enrolment');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6', 'aal2');
select public.admin_confirm_enrolment((select id from public.enrolments where member_id = '00000000-0000-0000-0000-0000000000d1'));
select pg_temp.check((select status from public.enrolments where member_id = '00000000-0000-0000-0000-0000000000d1') = 'confirmed', 'admin marks the seat paid');
select pg_temp.check((select paid_marked_by from public.enrolments where member_id = '00000000-0000-0000-0000-0000000000d1') = '00000000-0000-0000-0000-0000000000a6', 'who marked it paid is recorded');
select public.admin_cancel_enrolment((select id from public.enrolments where member_id = '00000000-0000-0000-0000-0000000000d2'));
select pg_temp.check((select status from public.enrolments where member_id = '00000000-0000-0000-0000-0000000000d2') = 'cancelled', 'admin cancels an enrolment');
select pg_temp.expect_error($$select public.admin_confirm_enrolment((select id from public.enrolments where member_id = '00000000-0000-0000-0000-0000000000d2'))$$, '%not_payable%', 'a cancelled seat cannot be marked paid');
select pg_temp.check((select count(*) from public.audit_log where action like 'enrolment.%') = 4, 'offers, payments and cancellations are audited');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select pg_temp.check(not ('tvs_learners' = any (public.my_access_levels())), 'cancelling removes the TVS learners level');

-- ---------------------------------------------------------------- admins write programs and links
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_error($$insert into public.programs (slug, name) values ('x', 'Hack')$$, '%row-level security%', 'members cannot create programs');
select pg_temp.expect_error($$insert into public.event_links (event_id, meet_url) values ('42000000-0000-0000-0000-000000000001', 'https://evil.example')$$, '%row-level security%', 'members cannot change Meet links');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6', 'aal2');
insert into public.programs (slug, name) values ('mentor360', 'Mentor360');
update public.event_links set meet_url = 'https://meet.google.com/new-link-abc';
select pg_temp.check((select meet_url from public.event_links) = 'https://meet.google.com/new-link-abc', 'admins change Meet links');
select pg_temp.expect_error($$update public.event_links set meet_url = 'javascript:alert(1)'$$, '%meet_url_check%', 'Meet links must be https');

rollback;
