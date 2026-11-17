-- Profile businesses join the CRM; relationship tags; the team starts conversations. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'mona@test', '{"name":"Mona"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'omar@test', '{"name":"Omar"}'),
  ('00000000-0000-0000-0000-0000000000d9', 'msgmanage@test', '{}'),
  ('00000000-0000-0000-0000-0000000000d8', 'msgview@test', '{}');
insert into public.admin_users (user_id, username, display_name, permissions) values
  ('00000000-0000-0000-0000-0000000000d9', 'msg.manager', 'Msg Manager', '{messages.manage,businesses.manage}'),
  ('00000000-0000-0000-0000-0000000000d8', 'msg.viewer', 'Msg Viewer', '{messages.view}');

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

select pg_temp.check(public.crm_domain('https://www.NilePay.example/about') = 'nilepay.example', 'domains are normalised');
select pg_temp.check(public.crm_domain('https://www.linkedin.com/company/x') = '', 'social links are not business domains');
select pg_temp.check(public.crm_name_key('Nile-Pay LLC') = public.crm_name_key('nile pay'), 'names written differently match');

-- Mona lists two businesses; Omar lists one of them with a different spelling.
select public.write_businesses('00000000-0000-0000-0000-0000000000d1',
  '[{"name":"Nile Pay","type":"Venture","stage":"Seed","website":"https://nilepay.example","member_role":"CEO"},{"name":"Cairo Angels","type":"Angel Investor","member_role":"Member"}]');
select pg_temp.check((select count(*) = 2 from public.companies where name in ('Nile Pay', 'Cairo Angels')), 'profile businesses are added to the CRM');
select pg_temp.check((select role = 'CEO' and source = 'profile' from public.company_people cp join public.companies c on c.id = cp.company_id where c.name = 'Nile Pay' and cp.member_id = '00000000-0000-0000-0000-0000000000d1'), 'the member is linked with their role');
select public.write_businesses('00000000-0000-0000-0000-0000000000d2', '[{"name":"NilePay","website":"http://www.nilepay.example/","member_role":"CTO"}]');
select pg_temp.check((select count(*) = 1 from public.companies where public.crm_domain(website) = 'nilepay.example'), 'a matching website links to the same business');
select pg_temp.check((select count(*) = 2 from public.company_people cp join public.companies c on c.id = cp.company_id where c.name = 'Nile Pay'), 'both members are on the business');

-- Saving the profile again keeps one link and updates the role.
select public.write_businesses('00000000-0000-0000-0000-0000000000d1',
  '[{"name":"Nile Pay","type":"Venture","stage":"Seed","website":"https://nilepay.example","member_role":"Founder & CEO"},{"name":"Cairo Angels","type":"Angel Investor","member_role":"Member"}]');
select pg_temp.check((select count(*) = 1 and min(role) = 'Founder & CEO' from public.company_people cp join public.companies c on c.id = cp.company_id where c.name = 'Nile Pay' and cp.member_id = '00000000-0000-0000-0000-0000000000d1'), 'saving again updates the role without duplicates');

-- A team link survives the member removing that business; the profile link does not.
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d9');
update public.company_people set source = 'team', role = 'Board advisor' where member_id = '00000000-0000-0000-0000-0000000000d1' and company_id = (select id from public.companies where name = 'Cairo Angels');
update public.companies set relationships = '{Partner,Client}' where name = 'Nile Pay';
select pg_temp.expect_error($$update public.companies set relationships = '{Friend}' where name = 'Nile Pay'$$, '%check%', 'relationship tags come from the list');
reset role;
select public.write_businesses('00000000-0000-0000-0000-0000000000d1', '[]');
select pg_temp.check((select count(*) = 1 and min(role) = 'Board advisor' from public.company_people where member_id = '00000000-0000-0000-0000-0000000000d1'), 'removing businesses drops only automatic links');
select pg_temp.check((select count(*) = 1 from public.company_people cp join public.companies c on c.id = cp.company_id where c.name = 'Nile Pay'), 'the business and other people stay');
select pg_temp.check((select relationships = '{Partner,Client}' from public.companies where name = 'Nile Pay'), 'businesses keep several relationship tags');

-- The team starts a conversation.
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d8');
select pg_temp.expect_error($$select public.team_start_thread('00000000-0000-0000-0000-0000000000d2', 'Hello')$$, '%not_admin%', 'viewers cannot start conversations');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d9');
select public.team_start_thread('00000000-0000-0000-0000-0000000000d2', 'Hi Omar, welcome to VentureWeavers.');
select public.team_start_thread('00000000-0000-0000-0000-0000000000d2', 'One more thing.');
select pg_temp.check((select count(*) = 1 from public.message_threads where member_id = '00000000-0000-0000-0000-0000000000d2'), 'one conversation per member');
select pg_temp.check((select count(*) = 2 and bool_and(from_team) from public.messages m join public.message_threads t on t.id = m.thread_id where t.member_id = '00000000-0000-0000-0000-0000000000d2'), 'team messages are stored');
select pg_temp.expect_error($$select public.team_start_thread('00000000-0000-0000-0000-0000000000d8', 'Hi')$$, '%not_found%', 'admin accounts cannot be messaged');
reset role;
select pg_temp.check((select count(*) >= 2 from public.notifications where member_id = '00000000-0000-0000-0000-0000000000d2' and href = '/messages'), 'the member is told in their bell');

rollback;
