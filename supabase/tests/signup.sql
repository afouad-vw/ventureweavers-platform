-- Phase 12 tests: profile details, Calendly bookings, content preview images. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c7', 'cal1@test', '{"name":"Cal One"}'),
  ('00000000-0000-0000-0000-0000000000c8', 'cal2@test', '{"name":"Cal Two"}');

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

-- ---------------------------------------------------------------- profile details
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c7');
update public.profiles set country = 'Egypt', linkedin = 'https://www.linkedin.com/in/cal-one', contact_prefs = array['WhatsApp', 'Call'], goals = array['Education', 'QuidQuo'], phone = '+20 1001234567'
where id = '00000000-0000-0000-0000-0000000000c7';
select pg_temp.check((select country = 'Egypt' and cardinality(contact_prefs) = 2 from public.profiles where id = '00000000-0000-0000-0000-0000000000c7'), 'members save country, LinkedIn and how we communicate');
select pg_temp.expect_error($$update public.profiles set linkedin = 'https://evil.example/in/x' where id = '00000000-0000-0000-0000-0000000000c7'$$, '%check%', 'LinkedIn must be a linkedin.com profile');
select pg_temp.expect_error($$update public.profiles set contact_prefs = array['Pigeon'] where id = '00000000-0000-0000-0000-0000000000c7'$$, '%check%', 'communication choices are WhatsApp, Email or Call');
update public.profiles set country = 'Nowhere' where id = '00000000-0000-0000-0000-0000000000c8';
reset role;
select pg_temp.check((select country is null from public.profiles where id = '00000000-0000-0000-0000-0000000000c8'), 'members cannot change someone else''s profile');

-- ---------------------------------------------------------------- Calendly bookings
insert into public.services (id, slug, name, space, status) values ('c0000000-0000-0000-0000-000000000001', 'cal-svc', 'Cal service', 'BRICKR', 'published');
set local role anon;
select pg_temp.expect_error($$select public.record_calendly_booking('c0000000-0000-0000-0000-000000000001', null, 'https://api.calendly.com/scheduled_events/AAAAAAAAAA/invitees/BBBBBBBBBB', null, null, null)$$, '%permission denied%', 'visitors cannot record bookings');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c7');
select pg_temp.expect_error($$select public.record_calendly_booking('c0000000-0000-0000-0000-000000000001', null, 'https://evil.example/x', null, null, null)$$, '%bad_booking%', 'only real Calendly booking addresses');
create temp table r1 as select public.record_calendly_booking('c0000000-0000-0000-0000-000000000001', 'https://api.calendly.com/scheduled_events/EVENT00001',
  'https://api.calendly.com/scheduled_events/EVENT00001/invitees/INVITE0001', now() + interval '45 days', 'https://meet.google.com/abc-defg-hij', 'Growth questions') as id;
grant select on r1 to authenticated;
select pg_temp.check((select meeting_at > now() + interval '44 days' and meeting_url like 'https://meet.google.com/%' and status = 'new' and member_id = '00000000-0000-0000-0000-0000000000c7' from public.requests where id = (select id from r1)), 'booking recorded with time, Meet link and member (even beyond 30 days)');
select pg_temp.check(public.record_calendly_booking('c0000000-0000-0000-0000-000000000001', null, 'https://api.calendly.com/scheduled_events/EVENT00001/invitees/INVITE0001', null, null, null) = (select id from r1), 'the same booking is recorded once');
select pg_temp.expect_error($$insert into public.requests (member_id, service_id, preferred_at, calendly_invitee) values ('00000000-0000-0000-0000-0000000000c7', 'c0000000-0000-0000-0000-000000000001', now() + interval '1 day', 'https://api.calendly.com/scheduled_events/X/invitees/Y')$$, '%permission denied%', 'members cannot set Calendly fields directly');
select public.record_calendly_booking('c0000000-0000-0000-0000-000000000001', null, 'https://api.calendly.com/scheduled_events/EVENT0000' || g || '/invitees/INVITE000' || g, null, null, null) from generate_series(2, 5) g;
select pg_temp.expect_error($$select public.record_calendly_booking('c0000000-0000-0000-0000-000000000001', null, 'https://api.calendly.com/scheduled_events/EVENT00009/invitees/INVITE0009', null, null, null)$$, '%too_many_open%', 'the open-request limit still applies');
reset role;
select pg_temp.check((select count(*) from public.notifications where member_id = '00000000-0000-0000-0000-0000000000c7' and text like 'Meeting confirmed: Cal service%') = 1, 'member is notified of the confirmed meeting');
select pg_temp.check((select space = 'TVS' and status = 'published' from public.services where slug = 'custom-program'), 'TVS custom program service exists');

-- ---------------------------------------------------------------- content preview images
insert into public.content_items (title, format, platform, image_url) values ('Preview', 'Episode', 'YouTube', 'https://x.supabase.co/storage/v1/object/public/content-images/2026-11/a.jpg');
select pg_temp.expect_error($$insert into public.content_items (title, format, platform, image_url) values ('Bad', 'Episode', 'YouTube', 'https://evil.example/a.jpg')$$, '%check%', 'preview images come from the upload bucket');

-- ---------------------------------------------------------------- settings
select pg_temp.check((select count(*) from public.site_settings where key = 'calendly_url') = 1, 'Calendly link setting exists');

rollback;
