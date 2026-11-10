-- Phase 11 tests: new content fields, cohort Meet links, brochures and galleries, settings. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000ac', 'admin12@test', '{"name":"Admin Twelve"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'f1@test', '{"name":"Learner One"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'f2@test', '{"name":"Offered Two"}');
insert into public.admin_users (user_id, username, display_name) values ('00000000-0000-0000-0000-0000000000ac', 'admin.twelve', 'Admin Twelve');
update public.admin_users set is_super = true; -- test admins are super admins (Phase 14)

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

-- ---------------------------------------------------------------- validators
select pg_temp.check(public.is_people('[{"name":"Ahmed Fouad","title":"Co-founder"},{"name":"Karim Hemdan"}]'), 'people list with and without titles');
select pg_temp.check(not public.is_people('[{"title":"No name"}]'), 'people need a name');
select pg_temp.check(not public.is_people('"Ahmed"'), 'people must be a list');
select pg_temp.check(public.is_outline('[{"title":"Market sizing","hours":2},{"title":"Pricing","hours":1.5}]'), 'outline with hours');
select pg_temp.check(not public.is_outline('[{"title":"Too long","hours":120}]'), 'session hours at most 100');
select pg_temp.check(not public.is_outline('[{"title":"No hours"}]'), 'sessions need hours');
select pg_temp.check(not public.is_outline('[{"title":"Text hours","hours":"2"}]'), 'hours must be a number');
select pg_temp.check(public.is_short_list(array['Laptop', 'A venture idea']), 'short list');
select pg_temp.check(not public.is_short_list(array['  ']), 'no blank list items');
select pg_temp.check(public.is_brochure('https://x.supabase.co/storage/v1/object/public/brochures/programs/a.pdf'), 'brochure URL');
select pg_temp.check(not public.is_brochure('https://evil.example/storage/v1/object/public/brochures/a.exe'), 'brochures are PDFs in our bucket');
select pg_temp.check(public.is_gallery('["https://x.supabase.co/storage/v1/object/public/event-gallery/e/1.jpg"]'), 'gallery URL');
select pg_temp.check(not public.is_gallery('["https://x.supabase.co/storage/v1/object/public/content-images/1.jpg"]'), 'gallery photos come from the gallery bucket');
select pg_temp.check(not public.is_gallery((select jsonb_agg('https://x.supabase.co/storage/v1/object/public/event-gallery/e/' || g || '.jpg') from generate_series(1, 13) g)), 'gallery holds at most 12 photos');

-- ---------------------------------------------------------------- rows accept the new fields
insert into public.programs (id, slug, name, status, short_description, outline, hosts, prerequisites)
values ('b0000000-0000-0000-0000-000000000001', 'detail-prog', 'DetailProg', 'open', 'Short', '[{"title":"Intro","hours":2}]', '[{"name":"Ahmed Fouad","title":"Host"}]', array['A venture idea']);
insert into public.cohorts (id, program_id, label, starts_on, ends_on, format, location, capacity, price_piasters)
values ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Cohort 1', '2026-12-01', '2027-01-30', 'Online', null, 30, 2000000);
select pg_temp.expect_error($$insert into public.cohorts (program_id, starts_on, ends_on) values ('b0000000-0000-0000-0000-000000000001', '2026-12-10', '2026-12-01')$$, '%cohort_dates%', 'cohort cannot end before it starts');
select pg_temp.expect_error($$insert into public.cohorts (program_id, format) values ('b0000000-0000-0000-0000-000000000001', 'Hybrid')$$, '%check%', 'format is Online or In person');
insert into public.cohort_links (cohort_id, meet_url) values ('b1000000-0000-0000-0000-000000000001', 'https://meet.google.com/abc-defg-hij');
insert into public.enrolments (member_id, cohort_id, status, amount_piasters, pay_reference) values
  ('00000000-0000-0000-0000-0000000000f1', 'b1000000-0000-0000-0000-000000000001', 'confirmed', 2000000, 'VWT-DET001'),
  ('00000000-0000-0000-0000-0000000000f2', 'b1000000-0000-0000-0000-000000000001', 'offered', 2000000, 'VWT-DET002');
insert into public.events (id, slug, title, type, starts_at, ends_at, capacity, status, host_list, guest_list, gallery)
values ('b2000000-0000-0000-0000-000000000001', 'detail-mc', 'Detail masterclass', 'masterclass', now() + interval '3 days', now() + interval '3 days 2 hours', 40, 'published',
        '[{"name":"Karim Hemdan","title":"Host"}]', '[{"name":"A guest","title":"Founder"},{"name":"Another guest"}]',
        '["https://x.supabase.co/storage/v1/object/public/event-gallery/e/1.jpg"]');
select pg_temp.expect_error($$update public.events set ends_at = starts_at - interval '1 hour' where id = 'b2000000-0000-0000-0000-000000000001'$$, '%event_end_after_start%', 'event cannot end before it starts');
insert into public.services (slug, name, status, offerings, audience) values ('detail-svc', 'Detail service', 'published', array['Diagnostic', 'Plan', 'Hands-on support'], 'Founders scaling past their first 20 hires and portfolio teams');
select pg_temp.check((select cardinality(offerings) from public.services where slug = 'detail-svc') = 3, 'services hold offerings and a longer audience');

-- ---------------------------------------------------------------- cohort Meet links: enrolled learners and admins only
set local role anon;
select pg_temp.expect_error($$select * from public.cohort_links$$, '%permission denied%', 'visitors cannot read Meet links');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.check((select count(*) from public.cohort_links) = 1, 'enrolled learner sees the Meet link');
select pg_temp.expect_error($$insert into public.cohort_links (cohort_id) values ('b1000000-0000-0000-0000-000000000001')$$, '%row-level security%', 'learners cannot write Meet links');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select pg_temp.check((select count(*) from public.cohort_links) = 0, 'offered (not paid) member cannot see the Meet link');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ac');
select pg_temp.check((select count(*) from public.cohort_links) = 1, 'admins see Meet links');
update public.cohort_links set meet_url = null where cohort_id = 'b1000000-0000-0000-0000-000000000001';
select pg_temp.check((select meet_url from public.cohort_links) is null, 'admins can set the link back to TBA');

-- ---------------------------------------------------------------- storage: admin-only writes
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name) values ('brochures', 'programs/x.pdf')$$, '%row-level security%', 'members cannot upload brochures');
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name) values ('event-gallery', 'e/x.jpg')$$, '%row-level security%', 'members cannot upload gallery photos');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ac');
insert into storage.objects (bucket_id, name) values ('brochures', 'programs/x.pdf'), ('event-gallery', 'e/x.jpg');
select pg_temp.check(true, 'admins upload brochures and gallery photos');
reset role;
select pg_temp.check((select public and file_size_limit = 10485760 and allowed_mime_types = array['application/pdf'] from storage.buckets where id = 'brochures'), 'brochures: public, PDF only, 10 MB');
select pg_temp.check((select public and file_size_limit = 5242880 from storage.buckets where id = 'event-gallery'), 'gallery: public, 5 MB');

-- ---------------------------------------------------------------- custom programs inbox setting is admin-only
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.check((select count(*) from public.site_settings where key = 'custom_program_email') = 0, 'members cannot read the custom programs inbox');
select pg_temp.check(not (public.payment_instructions() ? 'custom_program_email'), 'payment instructions do not include it');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ac');
update public.site_settings set value = 'programs@example.com' where key = 'custom_program_email';
select pg_temp.check((select value from public.site_settings where key = 'custom_program_email') = 'programs@example.com', 'admins set the custom programs inbox');

rollback;
