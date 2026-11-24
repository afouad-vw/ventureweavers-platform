-- BLong member filters (Phase 19d). Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000d101', 'me19d@test', '{"name":"Me Viewer"}'),
  ('00000000-0000-0000-0000-00000000d102', 'f1@test', '{"name":"Fadi Founder"}'),
  ('00000000-0000-0000-0000-00000000d103', 'i1@test', '{"name":"Iman Investor"}'),
  ('00000000-0000-0000-0000-00000000d104', 'x1@test', '{"name":"Xena Blocked"}');
update public.profiles set onboarded_at = now() where id::text like '00000000-0000-0000-0000-00000000d10%';
update public.profiles set roles = '{Founder}', country = 'Egypt', visibility = 'public', created_at = now() - interval '2 days' where id = '00000000-0000-0000-0000-00000000d102';
update public.profiles set roles = '{"Angel Investor"}', country = 'Saudi Arabia', visibility = 'private', created_at = now() - interval '20 days' where id = '00000000-0000-0000-0000-00000000d103';
insert into public.member_businesses (member_id, name, type, stage, position) values
  ('00000000-0000-0000-0000-00000000d102', 'Fadi Labs', 'Venture', 'Seed', 0),
  ('00000000-0000-0000-0000-00000000d103', 'Iman Angels', 'Angel Investor', null, 0);
insert into public.follows (follower, followee, status) values ('00000000-0000-0000-0000-00000000d103', '00000000-0000-0000-0000-00000000d101', 'accepted');
insert into public.blocks (blocker, blocked) values ('00000000-0000-0000-0000-00000000d101', '00000000-0000-0000-0000-00000000d104');

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', label; end if;
  raise notice 'ok - %', label;
end $$;
grant execute on function pg_temp.check(boolean, text) to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000d101', 'role', 'authenticated')::text, true);

select pg_temp.check((select count(*) = 2 from public.member_search() where id::text like '00000000-0000-0000-0000-00000000d10%'), 'everyone but yourself and blocked members');
select pg_temp.check((select array_agg(name) = '{Fadi Founder}' from public.member_search(p_role => 'Founder') where id::text like '00000000-0000-0000-0000-00000000d10%'), 'by role');
select pg_temp.check((select array_agg(name) = '{Iman Investor}' from public.member_search(p_country => 'Saudi Arabia') where id::text like '00000000-0000-0000-0000-00000000d10%'), 'by country');
select pg_temp.check((select array_agg(name) = '{Fadi Founder}' from public.member_search(p_business_type => 'Venture', p_stage => 'Seed') where id::text like '00000000-0000-0000-0000-00000000d10%'), 'by business type and stage');
select pg_temp.check((select array_agg(name) = '{Iman Investor}' from public.member_search(p_visibility => 'private') where id::text like '00000000-0000-0000-0000-00000000d10%'), 'Public or Private');
select pg_temp.check((select array_agg(name) = '{Iman Investor}' from public.member_search(p_follows_me => true) where id::text like '00000000-0000-0000-0000-00000000d10%'), 'people who follow you');
select pg_temp.check((select array_agg(name order by ord) = '{Fadi Founder,Iman Investor}' from (select name, row_number() over () ord from public.member_search(p_sort => 'newest') where id::text like '00000000-0000-0000-0000-00000000d10%') x), 'newest first');
select pg_temp.check('Egypt' = any (public.member_countries()), 'the country list');

rollback;
