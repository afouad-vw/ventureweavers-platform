-- BLong activity and feed (Phase 18d): who sees what someone did. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;
-- Phase 19a: approval is tested in blong_controls.sql; these tests create live items.
update public.blong_settings set approve_communities = false, approve_discussions = false;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000e101', 'doer@test', '{"name":"Dina Doer"}'),
  ('00000000-0000-0000-0000-00000000e102', 'fan@test', '{"name":"Fady Fan"}'),
  ('00000000-0000-0000-0000-00000000e103', 'stranger@test', '{"name":"Sara Stranger"}');
update public.profiles set onboarded_at = now() where id::text like '00000000-0000-0000-0000-00000000e10%';

-- What Dina did: a public show, a private session, a draft show, a cancelled booking
insert into public.events (id, slug, title, type, starts_at, capacity, status, visibility) values
  ('00000000-0000-0000-0000-0000000ee001', 'act-show', 'Open Floor Show 99', 'public_show', now() + interval '7 days', 50, 'published', 'public'),
  ('00000000-0000-0000-0000-0000000ee002', 'act-private', 'Private dinner', 'public_show', now() + interval '7 days', 50, 'published', 'private'),
  ('00000000-0000-0000-0000-0000000ee003', 'act-mc', 'Pricing masterclass', 'masterclass', now() - interval '7 days', 50, 'published', 'public');
insert into public.bookings (event_id, member_id, seats, amount_piasters, status, pay_reference) values
  ('00000000-0000-0000-0000-0000000ee001', '00000000-0000-0000-0000-00000000e101', 1, 0, 'confirmed', 'ACT-1'),
  ('00000000-0000-0000-0000-0000000ee002', '00000000-0000-0000-0000-00000000e101', 1, 0, 'confirmed', 'ACT-2'),
  ('00000000-0000-0000-0000-0000000ee003', '00000000-0000-0000-0000-00000000e101', 1, 0, 'cancelled', 'ACT-3');

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', label; end if;
  raise notice 'ok - %', label;
end $$;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated;
create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(text) to anon, authenticated;

set local role authenticated;

-- Dina starts a public community and a private one
select pg_temp.as_user('00000000-0000-0000-0000-00000000e101');
select pg_temp.check(public.create_community('Open Founders', 'For founders.', 'Interest', '{}', '{}', 'public') is not null, 'a public community');
select pg_temp.check(public.create_community('Secret Circle', 'Hidden talk.', 'Interest', '{}', '{}', 'private') is not null, 'a private community');
select pg_temp.check((select count(*) = 3 from public.member_activity(auth.uid())), 'members see their own activity');

-- Dina is Private: strangers and pending followers see nothing
select pg_temp.as_user('00000000-0000-0000-0000-00000000e103');
select pg_temp.check((select count(*) = 0 from public.member_activity('00000000-0000-0000-0000-00000000e101')), 'a Private member''s activity is hidden from strangers');
select pg_temp.as_user('00000000-0000-0000-0000-00000000e102');
select pg_temp.check(public.follow_member('00000000-0000-0000-0000-00000000e101') = 'requested', 'Fady asks to follow');
select pg_temp.check((select count(*) = 0 from public.blong_feed()), 'nothing in the feed before the request is accepted');

select pg_temp.as_user('00000000-0000-0000-0000-00000000e101');
select public.respond_follow('00000000-0000-0000-0000-00000000e102', true);

select pg_temp.as_user('00000000-0000-0000-0000-00000000e102');
select pg_temp.check((select count(*) = 2 and bool_and(title in ('Open Floor Show 99', 'Open Founders'))
  from public.member_activity('00000000-0000-0000-0000-00000000e101')),
  'followers see public shows and public communities, never private items, cancelled seats or private communities');
select pg_temp.check((select verb = 'Going to' from public.member_activity('00000000-0000-0000-0000-00000000e101') where kind = 'events'), 'upcoming shows read Going to');
select pg_temp.check((select count(*) = 2 and bool_and(name = 'Dina Doer') from public.blong_feed()), 'the feed shows followed members'' activity');

-- Dina hides events
select pg_temp.as_user('00000000-0000-0000-0000-00000000e101');
update public.profiles set show_activity = '{communities,posts}' where id = auth.uid();
select pg_temp.as_user('00000000-0000-0000-0000-00000000e102');
select pg_temp.check((select count(*) = 1 and bool_and(kind = 'communities') from public.member_activity('00000000-0000-0000-0000-00000000e101')), 'members choose which kinds to show');

-- Going Public shows activity to everyone
select pg_temp.as_user('00000000-0000-0000-0000-00000000e101');
update public.profiles set visibility = 'public' where id = auth.uid();
select pg_temp.as_user('00000000-0000-0000-0000-00000000e103');
select pg_temp.check((select count(*) = 1 from public.member_activity('00000000-0000-0000-0000-00000000e101')), 'a Public member''s activity is visible to anyone');
select pg_temp.check((select count(*) = 0 from public.blong_feed()), 'the feed only has people you follow');

-- Blocking hides it again
select pg_temp.as_user('00000000-0000-0000-0000-00000000e101');
select public.block_member('00000000-0000-0000-0000-00000000e103');
select pg_temp.as_user('00000000-0000-0000-0000-00000000e103');
select pg_temp.check((select count(*) = 0 from public.member_activity('00000000-0000-0000-0000-00000000e101')), 'blocked members see no activity');

rollback;
