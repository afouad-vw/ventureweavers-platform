-- Phase 6b tests: the classroom is only for confirmed learners in that cohort, and admins. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a7', 'admin7@test', '{"name":"Admin Seven"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'e1@test', '{"name":"Learner E1"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'e2@test', '{"name":"Offered E2"}'),
  ('00000000-0000-0000-0000-0000000000e3', 'e3@test', '{"name":"Other cohort E3"}'),
  ('00000000-0000-0000-0000-0000000000e4', 'e4@test', '{"name":"Member E4"}');
insert into public.admin_users (user_id, username, display_name) values ('00000000-0000-0000-0000-0000000000a7', 'admin.seven', 'Admin Seven');
update public.admin_users set is_super = true; -- test admins are super admins (Phase 14)

insert into public.programs (id, slug, name, kind, status) values ('50000000-0000-0000-0000-000000000001', 'tvac-t', 'TVAC', 'Foundation', 'open');
insert into public.cohorts (id, program_id, label) values
  ('51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Cohort 1'),
  ('51000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'Cohort 2');
insert into public.enrolments (member_id, cohort_id, status, amount_piasters, pay_reference) values
  ('00000000-0000-0000-0000-0000000000e1', '51000000-0000-0000-0000-000000000001', 'confirmed', 0, 'VWT-T00001'),
  ('00000000-0000-0000-0000-0000000000e2', '51000000-0000-0000-0000-000000000001', 'offered', 100, 'VWT-T00002'),
  ('00000000-0000-0000-0000-0000000000e3', '51000000-0000-0000-0000-000000000002', 'confirmed', 0, 'VWT-T00003');

insert into public.modules (id, cohort_id, position, title, opens_at) values
  ('52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 1, 'Venture foundations', now() - interval '7 days'),
  ('52000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000001', 2, 'Customer & market', null),
  ('52000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-000000000002', 1, 'Other cohort module', now() - interval '1 day');
insert into public.module_steps (id, module_id, position, title, kind) values
  ('53000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', 1, 'Read the case', 'case'),
  ('53000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000002', 1, 'Locked step', 'reading');
insert into public.assignments (id, module_id, title, due_at) values
  ('54000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', 'Founder fit canvas', now() + interval '3 days'),
  ('54000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000002', 'Market map', now() + interval '10 days');
insert into public.class_sessions (cohort_id, title, starts_at, meet_url) values
  ('51000000-0000-0000-0000-000000000001', 'Workshop', now() + interval '2 days', 'https://meet.google.com/aaa-bbbb-ccc');
insert into public.cohort_files (cohort_id, title, file_path, file_name, file_size) values
  ('51000000-0000-0000-0000-000000000001', 'Slides', 'files/2026-11/00000000-0000-0000-0000-000000000099.pdf', 'slides.pdf', 1000);

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
select pg_temp.expect_error($$select count(*) from public.modules$$, '%permission denied%', 'visitors cannot read modules');
select pg_temp.expect_error($$select count(*) from public.class_sessions$$, '%permission denied%', 'visitors cannot read sessions');

-- ---------------------------------------------------------------- confirmed learner E1
reset role; set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check((select count(*) from public.modules) = 2, 'learner sees their cohort''s modules only');
select pg_temp.check((select count(*) from public.module_steps) = 2, 'learner sees their cohort''s steps');
select pg_temp.check((select count(*) from public.assignments) = 2, 'learner sees their cohort''s assignments');
select pg_temp.check((select meet_url from public.class_sessions) = 'https://meet.google.com/aaa-bbbb-ccc', 'learner sees the Meet link');
select pg_temp.check((select count(*) from public.cohort_files) = 1, 'learner sees the cohort documents');

insert into public.step_progress (step_id) values ('53000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from public.step_progress) = 1, 'learner ticks a step in an open module');
select pg_temp.expect_error($$insert into public.step_progress (step_id) values ('53000000-0000-0000-0000-000000000002')$$, '%module_locked%', 'steps in locked modules cannot be ticked');
select pg_temp.expect_error($$insert into public.step_progress (step_id, member_id) values ('53000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e3')$$, '%permission denied%', 'learners tick only their own steps');
delete from public.step_progress;
select pg_temp.check((select count(*) from public.step_progress) = 0, 'learner unticks a step');
insert into public.step_progress (step_id) values ('53000000-0000-0000-0000-000000000001');

-- submissions
select pg_temp.check(public.can_submit('54000000-0000-0000-0000-000000000001'), 'learner can hand in work for an open module');
select pg_temp.check(not public.can_submit('54000000-0000-0000-0000-000000000002'), 'not for a locked module');
select pg_temp.check(public.submit_assignment('54000000-0000-0000-0000-000000000001', 'submissions/00000000-0000-0000-0000-0000000000e1/11111111-1111-1111-1111-111111111111.pdf', 'canvas.pdf', 2000) is null, 'learner hands in work');
select pg_temp.check((select status from public.submissions) = 'submitted', 'work shows as submitted');
select pg_temp.check(public.submit_assignment('54000000-0000-0000-0000-000000000001', 'submissions/00000000-0000-0000-0000-0000000000e1/22222222-2222-2222-2222-222222222222.pdf', 'canvas-v2.pdf', 2500)
  = 'submissions/00000000-0000-0000-0000-0000000000e1/11111111-1111-1111-1111-111111111111.pdf', 'replacing returns the old file to delete');
select pg_temp.check((select count(*) from public.submissions) = 1, 'one submission per assignment');
select pg_temp.expect_error($$select public.submit_assignment('54000000-0000-0000-0000-000000000001', 'submissions/00000000-0000-0000-0000-0000000000e3/33333333-3333-3333-3333-333333333333.pdf', 'x.pdf', 10)$$, '%bad_path%', 'learners cannot point at someone else''s folder');
select pg_temp.expect_error($$select public.submit_assignment('54000000-0000-0000-0000-000000000002', 'submissions/00000000-0000-0000-0000-0000000000e1/44444444-4444-4444-4444-444444444444.pdf', 'x.pdf', 10)$$, '%cannot_submit%', 'no hand-ins for locked modules');
select pg_temp.expect_error($$insert into public.submissions (assignment_id, member_id, file_path, file_name, file_size) values ('54000000-0000-0000-0000-000000000001', auth.uid(), 'submissions/00000000-0000-0000-0000-0000000000e1/55555555-5555-5555-5555-555555555555.pdf', 'x.pdf', 1)$$, '%permission denied%', 'no direct writes to submissions');
select pg_temp.expect_error($$update public.submissions set status = 'reviewed', feedback = 'Great'$$, '%permission denied%', 'learners cannot review their own work');
select pg_temp.expect_error($$select public.admin_review_submission((select id from public.submissions), 'Great')$$, '%forbidden%', 'learners cannot call the review function');

-- discussion
insert into public.cohort_posts (cohort_id, body) values ('51000000-0000-0000-0000-000000000001', 'Is the buyer the CFO or the ops lead?');
select pg_temp.check((select is_host from public.cohort_posts) = false, 'learner posts are not host posts');
select pg_temp.expect_error($$insert into public.cohort_posts (cohort_id, body, is_host) values ('51000000-0000-0000-0000-000000000001', 'I am the host', true)$$, '%permission denied%', 'learners cannot mark posts as host');
select pg_temp.expect_error($$insert into public.cohort_posts (cohort_id, body) values ('51000000-0000-0000-0000-000000000002', 'Hello other cohort')$$, '%row-level security%', 'learners cannot post in other cohorts');
select pg_temp.expect_error($$insert into public.class_sessions (cohort_id, title, starts_at) values ('51000000-0000-0000-0000-000000000001', 'Mine', now())$$, '%row-level security%', 'learners cannot schedule sessions');
update public.cohort_posts set removed_at = now();
select pg_temp.check((select count(*) from public.cohort_posts where removed_at is null) = 1, 'learners cannot hide posts');

-- ---------------------------------------------------------------- offered (unpaid) E2
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select pg_temp.check((select count(*) from public.modules) = 0, 'unpaid offers do not open the classroom');
select pg_temp.check((select count(*) from public.class_sessions) = 0, 'unpaid offers see no Meet links');
select pg_temp.check((select count(*) from public.cohort_posts) = 0, 'unpaid offers do not see the discussion');
select pg_temp.check(not public.can_submit('54000000-0000-0000-0000-000000000001'), 'unpaid offers cannot hand in work');
select pg_temp.expect_error($$insert into public.step_progress (step_id) values ('53000000-0000-0000-0000-000000000001')$$, '%not_in_cohort%', 'unpaid offers cannot tick steps');
select pg_temp.expect_error($$insert into public.cohort_posts (cohort_id, body) values ('51000000-0000-0000-0000-000000000001', 'hi')$$, '%row-level security%', 'unpaid offers cannot post');

-- ---------------------------------------------------------------- another cohort's learner E3 and a plain member E4
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
select pg_temp.check((select count(*) from public.modules) = 1, 'other cohort sees only its own module');
select pg_temp.check((select count(*) from public.submissions) = 0, 'learners do not see each other''s work');
select pg_temp.check((select count(*) from public.cohort_posts) = 0, 'cohorts do not see each other''s discussion');
select pg_temp.check((select count(*) from public.cohort_files) = 0, 'cohorts do not see each other''s documents');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e4');
select pg_temp.check((select count(*) from public.modules) + (select count(*) from public.class_sessions) + (select count(*) from public.assignments) = 0, 'members outside the cohort see nothing');

-- ---------------------------------------------------------------- admin
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ee', 'aal2');
select pg_temp.check((select count(*) from public.modules) = 0, '2-step users who are not admins see nothing');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a7', 'aal2');
select pg_temp.check((select count(*) from public.modules) = 3, 'admins see every cohort');
select pg_temp.check((select count(*) from public.submissions) = 1, 'admins see all work');
select pg_temp.check((select count(*) from public.step_progress) = 1, 'admins see progress');
insert into public.cohort_posts (cohort_id, body) values ('51000000-0000-0000-0000-000000000001', 'Whoever owns the pain.');
select pg_temp.check((select is_host from public.cohort_posts where body like 'Whoever%') = true, 'admin posts are host posts');
select pg_temp.expect_error($$select public.admin_review_submission((select id from public.submissions), ' ')$$, '%feedback_needed%', 'review needs feedback');
select public.admin_review_submission((select id from public.submissions), 'Clear problem statement. Narrow the first segment.');
select pg_temp.check((select status from public.submissions) = 'reviewed', 'admin marks work reviewed');
update public.cohort_posts set removed_at = now() where body like 'Is the buyer%';
insert into public.class_sessions (cohort_id, title, starts_at) values ('51000000-0000-0000-0000-000000000001', 'Office hours', now() + interval '4 days');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check((select feedback from public.submissions) like 'Clear problem%', 'learner reads the feedback');
select pg_temp.check(not public.can_submit('54000000-0000-0000-0000-000000000001'), 'reviewed work is locked');
select pg_temp.expect_error($$select public.submit_assignment('54000000-0000-0000-0000-000000000001', 'submissions/00000000-0000-0000-0000-0000000000e1/66666666-6666-6666-6666-666666666666.pdf', 'late.pdf', 10)$$, '%cannot_submit%', 'cannot replace reviewed work');
select pg_temp.check((select count(*) from public.cohort_posts) = 1, 'hidden posts disappear for learners');
select pg_temp.check((select count(*) from public.class_sessions) = 2, 'learner sees new sessions');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a7', 'aal2');
select public.admin_reopen_submission((select id from public.submissions));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check(public.can_submit('54000000-0000-0000-0000-000000000001'), 'reopened work can be handed in again');

reset role;
select pg_temp.check((select public from storage.buckets where id = 'cohort-files') = false, 'cohort files bucket is private');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name) values ('cohort-files', 'submissions/x.pdf')$$, '%row-level security%', 'no direct uploads to cohort storage');

rollback;
