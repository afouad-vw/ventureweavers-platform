-- Phase 7b tests: contacts and notes are for admins with 2-step only. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a9', 'admin9@test', '{"name":"Admin Nine"}'),
  ('00000000-0000-0000-0000-0000000000c9', 'c9@test', '{"name":"Member C9"}');
insert into public.admin_users (user_id, username, display_name) values ('00000000-0000-0000-0000-0000000000a9', 'admin.nine', 'Admin Nine');
update public.admin_users set is_super = true; -- test admins are super admins (Phase 14)
insert into public.contacts (name, email, tags) values ('Tarek Nabil', 'tarek@example.com', '{BRICKR,QuidQuo}');
insert into public.contact_notes (member_id, note) values ('00000000-0000-0000-0000-0000000000c9', 'Strong on product.');

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

select pg_temp.expect_error($$insert into public.contacts (name, tags) values ('Bad', '{Mars}')$$, '%tags_check%', 'only known spaces as tags');
select pg_temp.expect_error($$insert into public.contacts (name, email) values ('Dup', 'TAREK@example.com')$$, '%contacts_email_idx%', 'no duplicate emails');
select pg_temp.expect_error($$insert into public.contact_notes (note) values ('orphan')$$, '%check%', 'a note belongs to exactly one person');

set local role anon;
select set_config('request.jwt.claims', '', true);
select pg_temp.expect_error($$select count(*) from public.contacts$$, '%permission denied%', 'visitors cannot read contacts');

reset role; set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c9');
select pg_temp.check((select count(*) from public.contacts) = 0, 'members see no contacts');
select pg_temp.check((select count(*) from public.contact_notes) = 0, 'members never see notes, even about themselves');
select pg_temp.expect_error($$insert into public.contacts (name) values ('Me')$$, '%row-level security%', 'members cannot add contacts');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000ee', 'aal2');
select pg_temp.check((select count(*) from public.contacts) = 0, '2-step users who are not admins see no contacts');
select pg_temp.expect_error($$insert into public.contacts (name) values ('No 2-step')$$, '%row-level security%', '2-step users who are not admins cannot add contacts');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a9', 'aal2');
select pg_temp.check((select count(*) from public.contacts) = 1, 'admins see contacts');
select pg_temp.check((select note from public.contact_notes) = 'Strong on product.', 'admins read notes');
insert into public.contacts (name, email, source) values ('Sara Fawzy', 'sara@example.com', 'CSV import');
update public.contact_notes set note = 'Needs pricing help.', tags = '{TVS}';
delete from public.contacts where email = 'sara@example.com';
select pg_temp.check((select count(*) from public.contacts) = 1, 'admins add and delete contacts');

rollback;
