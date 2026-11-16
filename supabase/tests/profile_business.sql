-- Profile photos, businesses (several per member), Ecosystem Roles, application answers. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'biz1@test', '{"name":"Biz One"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'biz2@test', '{"name":"Biz Two"}'),
  ('00000000-0000-0000-0000-0000000000f3', 'biz3@test', '{"name":"Biz Three"}'),
  ('00000000-0000-0000-0000-0000000000fa', 'bizadmin@test', '{}');
insert into public.admin_users (user_id, username, display_name, permissions) values ('00000000-0000-0000-0000-0000000000fa', 'biz.admin', 'Biz Admin', '{contacts.manage}');

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
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
update public.profiles set avatar_url = 'https://x.supabase.co/storage/v1/object/public/avatars/00000000-0000-0000-0000-0000000000f1/a.jpg'
where id = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.check((select avatar_url like 'https://%' from public.profiles where id = '00000000-0000-0000-0000-0000000000f1'), 'members save a photo');
select pg_temp.expect_error($$update public.profiles set avatar_url = 'javascript:alert(1)' where id = '00000000-0000-0000-0000-0000000000f1'$$, '%check%', 'photos must be https addresses');

-- Ecosystem Roles
update public.profiles set roles = array['Angel Investor', 'Founder'] where id = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.check((select role = 'Angel Investor' and roles = array['Angel Investor', 'Founder'] from public.profiles where id = '00000000-0000-0000-0000-0000000000f1'), 'members pick several roles; the first is their main role');
select pg_temp.expect_error($$update public.profiles set roles = array['Pirate'] where id = '00000000-0000-0000-0000-0000000000f1'$$, '%check%', 'roles come from the list');
select pg_temp.expect_error($$update public.profiles set roles = array['Founder', 'Founder'] where id = '00000000-0000-0000-0000-0000000000f1'$$, '%check%', 'no repeated roles');
update public.profiles set role = 'Founder' where id = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.check((select roles = array['Founder', 'Angel Investor'] from public.profiles where id = '00000000-0000-0000-0000-0000000000f1'), 'setting the single role moves it to the front of the list');

-- Businesses
select public.set_my_businesses('[{"name":"Nile Pay","type":"Venture","website":"https://nilepay.example","member_role":"Co-founder","linkedin":"https://www.linkedin.com/company/nilepay"},{"name":"Delta Angels","type":"Angel Investor"}]');
select pg_temp.check((select count(*) = 2 from public.member_businesses where member_id = '00000000-0000-0000-0000-0000000000f1'), 'members add several businesses');
select pg_temp.check((select stage is null from public.member_businesses where member_id = '00000000-0000-0000-0000-0000000000f1' and name = 'Nile Pay'), 'stage is optional');
select public.set_my_businesses('[{"name":"Nile Pay","type":"Venture","stage":"Seed"},{"name":"Delta Angels","type":"Angel Investor","stage":"Seed"}]');
select pg_temp.check((select string_agg(coalesce(stage, '-'), ',' order by position) = 'Seed,-' from public.member_businesses where member_id = '00000000-0000-0000-0000-0000000000f1'), 'stage is saved for ventures only');
select pg_temp.expect_error($$select public.set_my_businesses('[{"name":"X","type":"Venture","stage":"Series Z"}]')$$, '%check%', 'stage comes from the list');
select pg_temp.check((select string_agg(name, ',' order by position) = 'Nile Pay,Delta Angels' from public.member_businesses where member_id = '00000000-0000-0000-0000-0000000000f1'), 'businesses keep their order');
select public.set_my_businesses('[{"name":"Nile Pay","type":"Venture"}]');
select pg_temp.check((select count(*) = 1 from public.member_businesses where member_id = '00000000-0000-0000-0000-0000000000f1'), 'saving replaces the list');
select pg_temp.expect_error($$select public.set_my_businesses('[{"name":"X","type":"Pirate ship"}]')$$, '%check%', 'business type comes from the list');
select pg_temp.expect_error($$select public.set_my_businesses('[{"name":"X","website":"not a site"}]')$$, '%check%', 'website must be a web address');
select pg_temp.expect_error($$select public.set_my_businesses('[{"name":"X","linkedin":"https://evil.example/company/x"}]')$$, '%check%', 'business LinkedIn must be a linkedin.com page');
select pg_temp.expect_error($$select public.set_my_businesses('[{"name":""}]')$$, '%check%', 'a business needs a name');
select pg_temp.expect_error($$select public.set_my_businesses(('[' || repeat('{"name":"x"},', 10) || '{"name":"x"}]')::jsonb)$$, '%too_many_businesses%', 'at most 10 businesses');
select pg_temp.expect_error($$insert into public.member_businesses (member_id, name) values ('00000000-0000-0000-0000-0000000000f2', 'Sneaky')$$, '%permission%', 'members cannot write businesses directly');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select pg_temp.check((select count(*) = 0 from public.member_businesses where member_id = '00000000-0000-0000-0000-0000000000f1'), 'members cannot see other members'' businesses');

-- Partners edit roles and businesses from Contacts
select pg_temp.as_user('00000000-0000-0000-0000-0000000000fa');
select pg_temp.check((select count(*) = 1 from public.member_businesses where member_id = '00000000-0000-0000-0000-0000000000f1'), 'Contacts viewers see members'' businesses');
select public.admin_update_member('00000000-0000-0000-0000-0000000000f2', 'Biz Two', '+20 1001234567', null, 'Egypt', array['Mentor', 'Exploring the ecosystem'], array['Education'], array['Email'],
  '[{"name":"Two Co","type":"Institutional investor","website":"https://two.example"}]');
select pg_temp.expect_error($$select public.admin_update_member('00000000-0000-0000-0000-0000000000f2', 'Biz Two', '+20 1001234567', null, 'Egypt', array[]::text[], array['Education'], array['Email'], '[]')$$, '%bad_roles%', 'at least one role');
reset role;
select pg_temp.check((select role = 'Mentor' and cardinality(roles) = 2 from public.profiles where id = '00000000-0000-0000-0000-0000000000f2'), 'partners edit roles');
select pg_temp.check((select name = 'Two Co' and type = 'Institutional investor' from public.member_businesses where member_id = '00000000-0000-0000-0000-0000000000f2'), 'partners edit businesses');
select pg_temp.check((select after -> 'businesses' -> 0 ->> 'name' = 'Two Co' and before -> 'businesses' = '[]'::jsonb from public.audit_log where action = 'member.update' and entity_id = '00000000-0000-0000-0000-0000000000f2'), 'business edits are logged');

-- Application answers
select pg_temp.check(public.is_answers('[{"q":"Venture name","a":"Nile Pay"}]'), 'answers in the right shape pass');
select pg_temp.check(not public.is_answers('[{"q":"","a":"x"}]') and not public.is_answers('{"q":"x"}'), 'malformed answers are refused');
select pg_temp.check(not public.is_answers(('[' || repeat('{"q":"x","a":"y"},', 12) || '{"q":"x","a":"y"}]')::jsonb), 'at most 12 answers');

select pg_temp.check((select public from storage.buckets where id = 'avatars'), 'avatars bucket is public');

rollback;
