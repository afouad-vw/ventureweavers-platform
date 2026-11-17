-- Phase 17a: client projects. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'founder@tcs.test', '{"name":"Founder"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'portfolio.team@tcs.test', '{"name":"Portfolio Team"}'),
  ('00000000-0000-0000-0000-0000000000f3', 'venture.lead@tcs.test', '{"name":"Venture Lead"}'),
  ('00000000-0000-0000-0000-0000000000f4', 'stranger@test', '{"name":"Stranger"}'),
  ('00000000-0000-0000-0000-0000000000f5', 'later@tcs.test', '{"name":"Joins Later"}'),
  ('00000000-0000-0000-0000-0000000000f8', 'pm@vw.test', '{}'),
  ('00000000-0000-0000-0000-0000000000f9', 'viewer@vw.test', '{}');
insert into public.admin_users (user_id, username, display_name, permissions) values
  ('00000000-0000-0000-0000-0000000000f8', 'pm.admin', 'Projects Manager', '{projects.manage}'),
  ('00000000-0000-0000-0000-0000000000f9', 'pv.admin', 'Projects Viewer', '{projects.view}');

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

-- ---------------------------------------------------------------- staff set up a portfolio with two ventures
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f8');
insert into public.projects (id, slug, name, kind, retainer_amount, currency, term_months) values
  ('90000000-0000-0000-0000-000000000001', 'the-cooking-school', 'The Cooking School', 'portfolio', 3000, 'USD', 12);
insert into public.projects (id, slug, name, kind, parent_id) values
  ('90000000-0000-0000-0000-000000000002', 'tcs-venture-a', 'Venture A', 'venture', '90000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000003', 'tcs-venture-b', 'Venture B', 'venture', '90000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000004', 'other-client', 'Other client', 'venture', null);
select pg_temp.expect_error($$insert into public.projects (slug, name, kind, parent_id) values ('nested', 'Nested', 'venture', '90000000-0000-0000-0000-000000000002')$$, '%parent_not_portfolio%', 'ventures sit only under portfolios');
select pg_temp.expect_error($$insert into public.projects (slug, name, kind, parent_id) values ('bad-portfolio', 'Bad', 'portfolio', '90000000-0000-0000-0000-000000000001')$$, '%check%', 'portfolios have no parent');
select pg_temp.expect_error($$update public.projects set drive_url = 'javascript:alert(1)' where slug = 'the-cooking-school'$$, '%drive_url%', 'only https folder links');
update public.projects set drive_url = 'https://drive.google.com/drive/folders/19-mLRAchb5ryFwkD7OFWSdw28BaG5mpf', proposal_path = 'proposals/2026-11/2b9c6f0e-7a7e-4d3c-9b0f-1c2d3e4f5a6b.pdf', proposal_name = 'TCS - VW Fractional Leadership.pdf' where slug = 'the-cooking-school';
insert into public.project_members (project_id, member_id, role) values
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', 'lead'),
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f2', 'team'),
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f3', 'lead');
insert into public.project_members (project_id, email, name, role) values ('90000000-0000-0000-0000-000000000003', 'later@tcs.test', 'Joins Later', 'team');
insert into public.project_scope_items (project_id, dimension, title) values ('90000000-0000-0000-0000-000000000001', 'Portfolio Strategy', 'Portfolio roadmap');
insert into public.project_notes (project_id, body) values ('90000000-0000-0000-0000-000000000001', 'Founder prefers Sunday sessions.');
insert into public.project_meetings (project_id, title, kind, starts_at) values ('90000000-0000-0000-0000-000000000002', 'Venture A weekly', 'weekly', now() + interval '2 days');
insert into public.project_comments (project_id, body, internal) values ('90000000-0000-0000-0000-000000000001', 'Internal: check burn before the call', true);

-- ---------------------------------------------------------------- who sees what
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.check((select count(*) = 3 from public.projects), 'the portfolio lead sees the portfolio and its ventures');
select pg_temp.check((select public.project_role('90000000-0000-0000-0000-000000000002') = 'lead'), 'portfolio leads lead its ventures too');
select pg_temp.check((select count(*) = 0 from public.project_notes), 'clients never see partner notes');
select pg_temp.check((select count(*) = 0 from public.project_comments where internal), 'clients never see internal comments');
select pg_temp.check((select count(*) = 1 from public.project_meetings), 'portfolio people see venture meetings');
update public.projects set retainer_amount = 1 where slug = 'the-cooking-school';
select pg_temp.check((select retainer_amount = 3000 from public.projects where slug = 'the-cooking-school'), 'clients cannot change terms');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select pg_temp.check((select count(*) = 1 from public.projects), 'a venture lead sees only their venture');
select pg_temp.check((select slug from public.projects) = 'tcs-venture-a', 'and it is their venture');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f5');
select pg_temp.check((select count(*) = 1 from public.projects where slug = 'tcs-venture-b'), 'people added by email see the project when they join');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f4');
select pg_temp.check((select count(*) = 0 from public.projects), 'strangers see no projects');
select pg_temp.check((select count(*) = 0 from public.project_members), 'strangers see no project people');
select pg_temp.expect_error($$insert into public.project_requests (project_id, title) values ('90000000-0000-0000-0000-000000000001', 'Sneaky request')$$, '%not_allowed%', 'strangers cannot raise requests');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f9');
select pg_temp.check((select count(*) = 4 from public.projects), 'project viewers see every project');
select pg_temp.check((select count(*) = 1 from public.project_notes), 'project viewers read partner notes');
select pg_temp.expect_error($$insert into public.projects (slug, name) values ('viewer-made', 'Viewer made')$$, '%row-level security%', 'project viewers cannot create projects');

-- ---------------------------------------------------------------- requests and quotes
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
insert into public.project_requests (project_id, title, details, status, price, response) values
  ('90000000-0000-0000-0000-000000000001', 'Build the e-commerce venture', 'Hands-on build of the online store', 'approved', 1, 'self-approved');
select pg_temp.check((select status = 'submitted' and price is null and response = '' and source = 'client' from public.project_requests where title = 'Build the e-commerce venture'), 'client requests start as Submitted, without a price');
update public.project_requests set status = 'approved';
select pg_temp.check((select count(*) = 0 from public.project_requests where status = 'approved'), 'clients cannot change requests directly');
select pg_temp.expect_error($$select public.client_decide_request((select id from public.project_requests limit 1), true)$$, '%not_allowed%', 'team members cannot approve quotes');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f8');
insert into public.project_requests (project_id, title, source, received_note) values ('90000000-0000-0000-0000-000000000001', 'Investor deck review', 'team', 'Verbal, weekly session 12 Nov');
select pg_temp.expect_error($$update public.project_requests set status = 'quoted' where title = 'Investor deck review'$$, '%check%', 'a quote needs a price');
update public.project_requests set status = 'quoted', price = 2500, currency = 'USD', response = 'Two-week build sprint', requirements = 'Access to the store admin', timeline = '2 weeks' where title = 'Build the e-commerce venture';
select pg_temp.expect_error($$update public.project_requests set status = 'approved' where title = 'Build the e-commerce venture'$$, '%client_decides%', 'staff cannot approve on the client''s behalf');
select pg_temp.expect_error($$update public.project_requests set status = 'in_progress' where title = 'Build the e-commerce venture'$$, '%needs_approval%', 'paid work waits for the client''s approval');
update public.project_requests set status = 'declined', decline_reason = 'Out of scope for now' where title = 'Investor deck review';

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f3');
select pg_temp.expect_error($$select public.client_decide_request((select id from public.project_requests where title = 'Build the e-commerce venture'), true)$$, '%not_allowed%', 'a venture lead cannot approve the portfolio''s quotes');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.check((select public.client_decide_request((select id from public.project_requests where title = 'Build the e-commerce venture'), true) = 'approved'), 'the portfolio lead approves the quote');
select pg_temp.check((select status = 'approved' and decided_by = '00000000-0000-0000-0000-0000000000f1' from public.project_requests where title = 'Build the e-commerce venture'), 'approval is recorded with who and when');
select pg_temp.expect_error($$select public.client_decide_request((select id from public.project_requests where title = 'Build the e-commerce venture'), false)$$, '%not_quoted%', 'a quote is decided once');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f8');
select pg_temp.expect_error($$update public.project_requests set price = 3000 where title = 'Build the e-commerce venture'$$, '%price_locked%', 'approved prices are fixed');
update public.project_requests set status = 'in_progress' where title = 'Build the e-commerce venture';
select pg_temp.check((select status = 'in_progress' from public.project_requests where title = 'Build the e-commerce venture'), 'approved work moves to in progress');

-- ---------------------------------------------------------------- proposal and comments
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select pg_temp.expect_error($$select public.client_accept_proposal('90000000-0000-0000-0000-000000000001')$$, '%not_allowed%', 'only the client lead accepts the proposal');
select pg_temp.expect_error($$insert into public.project_comments (project_id, body, internal) values ('90000000-0000-0000-0000-000000000001', 'sneaky', true)$$, '%row-level security%', 'clients cannot post internal comments');
insert into public.project_comments (project_id, target_type, body) values ('90000000-0000-0000-0000-000000000001', 'request', 'Can we start next week?');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select public.client_accept_proposal('90000000-0000-0000-0000-000000000001');
select pg_temp.check((select proposal_accepted_by = '00000000-0000-0000-0000-0000000000f1' from public.projects where slug = 'the-cooking-school'), 'the proposal is accepted by the lead');
select pg_temp.expect_error($$select public.client_accept_proposal('90000000-0000-0000-0000-000000000001')$$, '%nothing_to_accept%', 'a proposal is accepted once');

-- ---------------------------------------------------------------- bell notifications
reset role;
select pg_temp.check((select count(*) = 1 from public.notifications where member_id = '00000000-0000-0000-0000-0000000000f1' and text like 'Quote ready for your approval: Build the e-commerce venture'), 'the lead is told a quote is ready');
select pg_temp.check((select count(*) = 0 from public.notifications where member_id = '00000000-0000-0000-0000-0000000000f2' and text like 'Quote ready%'), 'team members are not asked to approve');
select pg_temp.check((select count(*) = 1 from public.notifications where member_id = '00000000-0000-0000-0000-0000000000f2' and text like 'Your request "Build the e-commerce venture" is in progress.'), 'the person who raised it hears it started');
select pg_temp.check((select count(*) = 1 from public.notifications where member_id = '00000000-0000-0000-0000-0000000000f1' and text like 'Meeting: Venture A weekly%'), 'portfolio people hear about venture meetings');
select pg_temp.check((select count(*) = 1 from public.notifications where member_id = '00000000-0000-0000-0000-0000000000f3' and text like 'Meeting: Venture A weekly%'), 'venture people hear about their meetings');
select pg_temp.check((select count(*) = 0 from public.notifications where member_id = '00000000-0000-0000-0000-0000000000f4'), 'strangers hear nothing');
select pg_temp.check((select count(*) = 1 from public.notifications where member_id = '00000000-0000-0000-0000-0000000000f3' and text = 'You''ve been added to the project Venture A.'), 'people are told when they are added');
select pg_temp.expect_error($$delete from public.projects where slug = 'the-cooking-school'$$, '%foreign key%', 'a portfolio with ventures cannot be deleted');
select pg_temp.check((select 'projects.manage' = any (public.admin_perm_list())), 'Projects is an access area');

rollback;
