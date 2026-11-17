-- Phase 15 part 3: business CRM. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'founder@test', '{"name":"Founder"}'),
  ('00000000-0000-0000-0000-0000000000c8', 'bizview@test', '{}'),
  ('00000000-0000-0000-0000-0000000000c9', 'bizmanage@test', '{}'),
  ('00000000-0000-0000-0000-0000000000c7', 'other@test', '{}');
insert into public.admin_users (user_id, username, display_name, permissions) values
  ('00000000-0000-0000-0000-0000000000c9', 'biz.manager', 'Biz Manager', '{businesses.manage}'),
  ('00000000-0000-0000-0000-0000000000c8', 'biz.viewer', 'Biz Viewer', '{businesses.view}'),
  ('00000000-0000-0000-0000-0000000000c7', 'content.only', 'Content Only', '{content.manage}');

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
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c9');
insert into public.companies (id, name, type, stage, website) values ('80000000-0000-0000-0000-000000000001', 'Nile Pay', 'Venture', 'Seed', 'https://nilepay.example');
insert into public.company_people (company_id, member_id, role) values ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'Co-founder');
insert into public.deals (id, company_id, title, type, value, currency) values ('80000000-0000-0000-0000-000000000011', '80000000-0000-0000-0000-000000000001', 'Fractional CFO, 6 months', 'Revenue-based', 18000, 'USD');
update public.deals set stage = 'Proposal' where id = '80000000-0000-0000-0000-000000000011';
update public.deals set stage = 'Won' where id = '80000000-0000-0000-0000-000000000011';
insert into public.company_activities (company_id, kind, body, due_at) values ('80000000-0000-0000-0000-000000000001', 'task', 'Send the proposal', now() + interval '2 days');
select pg_temp.check((select count(*) = 3 from public.company_activities where kind = 'stage'), 'deal stage changes are logged on the business');
select pg_temp.check((select closed_at is not null from public.deals where id = '80000000-0000-0000-0000-000000000011'), 'won deals get a closing time');
select pg_temp.expect_error($$insert into public.company_activities (company_id, kind, body) values ('80000000-0000-0000-0000-000000000001', 'stage', 'fake')$$, '%row-level security%', 'stage entries come from deals only');
select pg_temp.expect_error($$insert into public.company_activities (company_id, kind, body, due_at) values ('80000000-0000-0000-0000-000000000001', 'note', 'x', now())$$, '%check%', 'only tasks have due dates');
select pg_temp.expect_error($$insert into public.companies (name, type, stage) values ('Bank', 'Corporate', 'Seed')$$, '%check%', 'stage is for ventures only');
select pg_temp.expect_error($$insert into public.deals (company_id, title, stage) values ('80000000-0000-0000-0000-000000000001', 'X deal', 'Maybe')$$, '%check%', 'deal stages come from the list');
select pg_temp.expect_error($$insert into public.company_people (company_id, member_id) values ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1')$$, '%duplicate%', 'a person is linked once');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c8');
select pg_temp.check((select count(*) = 1 from public.companies) and (select count(*) = 1 from public.deals), 'viewers read businesses and deals');
select pg_temp.expect_error($$insert into public.companies (name) values ('Viewer Co')$$, '%row-level security%', 'viewers cannot add businesses');
update public.deals set stage = 'Lost';
select pg_temp.check((select stage = 'Won' from public.deals), 'viewers cannot move deals');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c7');
select pg_temp.check((select count(*) = 0 from public.companies) and (select count(*) = 0 from public.deals) and (select count(*) = 0 from public.company_activities), 'staff without the area see nothing');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select count(*) = 0 from public.companies) and (select count(*) = 0 from public.company_people), 'members never see the CRM, even their own business');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c9');
delete from public.companies where id = '80000000-0000-0000-0000-000000000001';
select pg_temp.check((select count(*) = 0 from public.deals) and (select count(*) = 0 from public.company_activities), 'deleting a business removes its deals and activity');
select pg_temp.check('businesses.manage' = any (public.admin_perm_list()), 'Businesses & deals is an admin access area');
rollback;
