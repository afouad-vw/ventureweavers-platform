-- Phase 17b: statuses, request categories, shared notes, client invites, tasks and wrap-ups. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'lead@client.test', '{"name":"Client Lead"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'team@client.test', '{"name":"Client Team"}'),
  ('00000000-0000-0000-0000-0000000000e3', 'newhire@client.test', '{"name":"New Hire"}'),
  ('00000000-0000-0000-0000-0000000000e4', 'outsider@client.test', '{"name":"Outsider"}'),
  ('00000000-0000-0000-0000-0000000000e8', 'pm2@vw.test', '{}');
insert into public.admin_users (user_id, username, display_name, permissions) values
  ('00000000-0000-0000-0000-0000000000e8', 'pm2.admin', 'Projects Manager', '{projects.manage}');

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
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e8');
insert into public.projects (id, slug, name, kind, term_months) values ('a9000000-0000-0000-0000-000000000001', 'pm-client', 'PM Client', 'portfolio', 12);
insert into public.project_members (project_id, member_id, role) values
  ('a9000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', 'lead'),
  ('a9000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e2', 'team');

-- ---------------------------------------------------------------- statuses move on their own
select pg_temp.check((select status = 'proposal' and status_auto from public.projects where slug = 'pm-client'), 'new projects start at Proposal, automatic moves on');
select pg_temp.expect_error($$update public.projects set status = 'setup' where slug = 'pm-client'$$, '%projects_status_check%', 'only the new statuses');
update public.projects set proposal_path = 'proposals/2026-11/2b9c6f0e-7a7e-4d3c-9b0f-1c2d3e4f5a6b.pdf', proposal_name = 'Proposal.pdf' where slug = 'pm-client';
select pg_temp.check((select status = 'pending_approval' from public.projects where slug = 'pm-client'), 'uploading the proposal makes it Pending approval');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select public.client_accept_proposal('a9000000-0000-0000-0000-000000000001');
select pg_temp.check((select status = 'approved' from public.projects where slug = 'pm-client'), 'the lead accepting approves it');
select pg_temp.check((select count(*) = 3 from public.project_status_log where project_id = 'a9000000-0000-0000-0000-000000000001'), 'clients can read the status history');
select pg_temp.check((select bool_and(auto) from public.project_status_log where project_id = 'a9000000-0000-0000-0000-000000000001' and from_status is not null), 'automatic moves are marked automatic');
select pg_temp.expect_error($$select public.project_auto_status()$$, '%permission denied%', 'clients cannot run the daily moves');

reset role;
update public.projects set starts_on = (now() at time zone 'Africa/Cairo')::date - 10 where slug = 'pm-client';
select pg_temp.check((select public.project_auto_status() = 1), 'the daily job moves started projects');
select pg_temp.check((select status = 'onboarding' from public.projects where slug = 'pm-client'), 'start date reached: Situation assessment');
update public.projects set starts_on = (now() at time zone 'Africa/Cairo')::date - 40 where slug = 'pm-client';
select public.project_auto_status();
select pg_temp.check((select status = 'active' from public.projects where slug = 'pm-client'), 'a month in: Active');
update public.projects set starts_on = (now() at time zone 'Africa/Cairo')::date - 340 where slug = 'pm-client';
select public.project_auto_status();
select pg_temp.check((select status = 'renewal' from public.projects where slug = 'pm-client'), 'a month before the end: Renewal due');
update public.projects set status = 'active', status_auto = false where slug = 'pm-client';
select public.project_auto_status();
select pg_temp.check((select status = 'active' from public.projects where slug = 'pm-client'), 'switching automatic moves off keeps the partners'' status');
select pg_temp.check((select count(*) >= 1 from public.notifications where member_id = '00000000-0000-0000-0000-0000000000e1' and text = 'PM Client is approved. Welcome aboard.'), 'client people hear when the project is approved');

-- ---------------------------------------------------------------- request categories
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
insert into public.project_requests (project_id, title, category, preferred_times) values ('a9000000-0000-0000-0000-000000000001', 'Call about the pricing model', 'meeting', 'Sunday or Monday afternoon');
select pg_temp.check((select category = 'meeting' and preferred_times like 'Sunday%' from public.project_requests where title = 'Call about the pricing model'), 'clients can ask for a meeting with preferred times');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e8');
select pg_temp.expect_error($$update public.project_requests set status = 'quoted', price = 100 where title = 'Call about the pricing model'$$, '%not_priced%', 'meeting requests are not quoted');
update public.project_requests set status = 'done' where title = 'Call about the pricing model';
select pg_temp.check((select status = 'done' from public.project_requests where title = 'Call about the pricing model'), 'unpriced requests are closed directly');

-- ---------------------------------------------------------------- notes
insert into public.project_notes (project_id, body) values ('a9000000-0000-0000-0000-000000000001', 'Partner-only: founder is cautious on spend');
insert into public.project_notes (project_id, body, shared) values ('a9000000-0000-0000-0000-000000000001', 'Shared: agreed Sunday 11:00 for weekly sessions', true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select pg_temp.check((select count(*) = 1 from public.project_notes), 'clients see shared notes only');
insert into public.project_notes (project_id, body, shared) values ('a9000000-0000-0000-0000-000000000001', 'Our team: we will share the Q3 numbers by Thursday', true);
select pg_temp.expect_error($$insert into public.project_notes (project_id, body, shared) values ('a9000000-0000-0000-0000-000000000001', 'sneaky private note', false)$$, '%row-level security%', 'clients cannot write partner-only notes');
update public.project_notes set body = 'changed' where body like 'Shared: agreed%';
select pg_temp.check((select count(*) = 0 from public.project_notes where body = 'changed'), 'clients cannot edit the partners'' notes');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e4');
select pg_temp.check((select count(*) = 0 from public.project_notes), 'outsiders see no notes');

-- ---------------------------------------------------------------- client invites
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select pg_temp.expect_error($$select public.client_invite_person('a9000000-0000-0000-0000-000000000001', 'x@client.test', 'X')$$, '%not_allowed%', 'team members cannot invite');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check((select public.client_invite_person('a9000000-0000-0000-0000-000000000001', 'NewHire@client.test', 'New Hire') = 'added'), 'leads add existing members by email');
select pg_temp.check((select public.client_invite_person('a9000000-0000-0000-0000-000000000001', 'cfo@client.test', 'CFO') = 'invited'), 'leads invite people who have not joined yet');
select pg_temp.check((select public.client_invite_person('a9000000-0000-0000-0000-000000000001', 'cfo@client.test', 'CFO') = 'already'), 'inviting twice does nothing');
select pg_temp.check((select count(*) = 2 from public.project_members where added_by = '00000000-0000-0000-0000-0000000000e1' and role = 'team'), 'invited people join as team members');
select pg_temp.expect_error($$select public.client_invite_person('a9000000-0000-0000-0000-000000000001', 'pm2@vw.test', 'PM')$$, '%team_account%', 'team accounts are not invited as clients');
select pg_temp.expect_error($$select public.client_remove_person((select id from public.project_members where member_id = '00000000-0000-0000-0000-0000000000e1'))$$, '%not_allowed%', 'leads cannot remove leads');
select public.client_remove_person((select id from public.project_members where email = 'cfo@client.test'));
select pg_temp.check((select count(*) = 0 from public.project_members where email = 'cfo@client.test'), 'leads remove team members');

-- ---------------------------------------------------------------- tasks and wrap-ups
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e8');
insert into public.project_milestones (id, project_id, title) values ('a9100000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000001', 'Before kick-off');
insert into public.project_tasks (project_id, milestone_id, title, owner_side, assignee_member) values
  ('a9000000-0000-0000-0000-000000000001', 'a9100000-0000-0000-0000-000000000001', 'Fill in the requirements sheet', 'client', '00000000-0000-0000-0000-0000000000e1');
insert into public.project_tasks (project_id, milestone_id, title) values ('a9000000-0000-0000-0000-000000000001', 'a9100000-0000-0000-0000-000000000001', 'Send the requirements sheet');
insert into public.project_tasks (project_id, title, internal) values ('a9000000-0000-0000-0000-000000000001', 'Internal: prepare pricing benchmarks', true);
select pg_temp.expect_error($$insert into public.project_tasks (project_id, title, internal, owner_side) values ('a9000000-0000-0000-0000-000000000001', 'bad', true, 'client')$$, '%check%', 'client tasks are never internal');
insert into public.project_updates (project_id, week_of, summary) values ('a9000000-0000-0000-0000-000000000001', current_date, 'Draft wrap-up');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select pg_temp.check((select count(*) = 2 from public.project_tasks), 'clients see shared tasks, not internal ones');
select pg_temp.check((select count(*) = 0 from public.project_updates), 'clients do not see draft wrap-ups');
select public.client_set_task_status((select id from public.project_tasks where title = 'Fill in the requirements sheet'), 'done');
select pg_temp.check((select status = 'done' and completed_at is not null from public.project_tasks where title = 'Fill in the requirements sheet'), 'clients complete their own tasks');
select pg_temp.expect_error($$select public.client_set_task_status((select id from public.project_tasks where title = 'Send the requirements sheet'), 'done')$$, '%not_allowed%', 'clients cannot complete the partners'' tasks');
update public.project_tasks set status = 'done' where title = 'Send the requirements sheet';
select pg_temp.check((select status = 'todo' from public.project_tasks where title = 'Send the requirements sheet'), 'clients cannot edit tasks directly');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e4');
select pg_temp.check((select count(*) = 0 from public.project_tasks), 'outsiders see no tasks');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e8');
update public.project_updates set published_at = now() where project_id = 'a9000000-0000-0000-0000-000000000001';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select pg_temp.check((select count(*) = 1 from public.project_updates), 'clients see published wrap-ups');
insert into public.project_comments (project_id, target_type, target_id, body) values ('a9000000-0000-0000-0000-000000000001', 'task', (select id from public.project_tasks where title = 'Fill in the requirements sheet'), 'Done, see the folder');

reset role;
select pg_temp.check((select count(*) = 1 from public.notifications where member_id = '00000000-0000-0000-0000-0000000000e1' and text like 'Task for you on PM Client: Fill in the requirements sheet'), 'assigned client people hear about their task');
select pg_temp.check((select count(*) = 1 from public.notifications where member_id = '00000000-0000-0000-0000-0000000000e3' and text = 'Weekly wrap-up for PM Client is ready.'), 'everyone on the project hears about the wrap-up');
select pg_temp.check((select count(*) = 0 from public.notifications where member_id = '00000000-0000-0000-0000-0000000000e4'), 'outsiders hear nothing');

rollback;
