-- Phase 14 tests: profile photos, business details, application answers. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'biz1@test', '{"name":"Biz One"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'biz2@test', '{"name":"Biz Two"}'),
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
update public.profiles set avatar_url = 'https://x.supabase.co/storage/v1/object/public/avatars/00000000-0000-0000-0000-0000000000f1/a.jpg',
  business_name = 'Nile Pay', business_website = 'https://nilepay.example', business_type = 'Venture'
where id = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.check((select business_type = 'Venture' and avatar_url like 'https://%' from public.profiles where id = '00000000-0000-0000-0000-0000000000f1'), 'members save a photo and business details');
select pg_temp.expect_error($$update public.profiles set avatar_url = 'javascript:alert(1)' where id = '00000000-0000-0000-0000-0000000000f1'$$, '%check%', 'photos must be https addresses');
select pg_temp.expect_error($$update public.profiles set business_type = 'Pirate ship' where id = '00000000-0000-0000-0000-0000000000f1'$$, '%check%', 'business type comes from the list');
select pg_temp.expect_error($$update public.profiles set business_website = 'not a site' where id = '00000000-0000-0000-0000-0000000000f1'$$, '%check%', 'website must be a web address');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000fa');
select public.admin_update_member('00000000-0000-0000-0000-0000000000f2', 'Biz Two', '+20 1001234567', null, 'Egypt', 'Founder', array['Education'], array['Email'], 'Two Co', 'https://two.example', 'Capital');
reset role;
select pg_temp.check((select business_name = 'Two Co' and business_type = 'Capital' from public.profiles where id = '00000000-0000-0000-0000-0000000000f2'), 'partners edit business details');
select pg_temp.check((select after ->> 'business_type' = 'Capital' from public.audit_log where action = 'member.update' and entity_id = '00000000-0000-0000-0000-0000000000f2'), 'business edits are logged');

-- Application answers
select pg_temp.check(public.is_answers('[{"q":"Venture name","a":"Nile Pay"}]'), 'answers in the right shape pass');
select pg_temp.check(not public.is_answers('[{"q":"","a":"x"}]') and not public.is_answers('{"q":"x"}'), 'malformed answers are refused');
select pg_temp.check(not public.is_answers(('[' || repeat('{"q":"x","a":"y"},', 12) || '{"q":"x","a":"y"}]')::jsonb), 'at most 12 answers');

select pg_temp.check((select public from storage.buckets where id = 'avatars'), 'avatars bucket is public');

rollback;
