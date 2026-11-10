-- Phase 11: richer programs, cohorts, masterclasses/shows and services; brochures; show galleries;
-- the custom-programs inbox setting. Plan: docs/phase-11-plan.md.

-- ---------------------------------------------------------------- validators

-- People (hosts, guests): [{ "name": "...", "title": "..." }], at most 10.
create or replace function public.is_people(v jsonb) returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'array' and jsonb_array_length(v) <= 10 and not exists (
    select 1 from jsonb_array_elements(v) p
    where jsonb_typeof(p) <> 'object'
       or char_length(coalesce(p->>'name', '')) not between 1 and 80
       or char_length(coalesce(p->>'title', '')) > 120) $$;

-- Outline: [{ "title": "...", "hours": 1.5 }], at most 40 sessions, 0.25 to 100 hours each.
create or replace function public.is_outline(v jsonb) returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'array' and jsonb_array_length(v) <= 40 and not exists (
    select 1 from jsonb_array_elements(v) s
    where jsonb_typeof(s) <> 'object'
       or char_length(coalesce(s->>'title', '')) not between 1 and 120
       or case when jsonb_typeof(s->'hours') = 'number' then (s->>'hours')::numeric not between 0.25 and 100 else true end) $$;

-- Short lists (pre-requisites, activities, offerings): at most 20 items of up to 200 characters.
create or replace function public.is_short_list(v text[]) returns boolean language sql immutable set search_path = '' as $$
  select cardinality(v) <= 20 and not exists (select 1 from unnest(v) x where char_length(btrim(x)) not between 1 and 200) $$;

create or replace function public.is_brochure(v text) returns boolean language sql immutable set search_path = '' as $$
  select v is null or (char_length(v) <= 500 and v ~ '^https://[^ ]+/storage/v1/object/public/brochures/[A-Za-z0-9/_.-]+\.pdf$') $$;

-- Gallery: up to 12 public image URLs from the event-gallery bucket.
create or replace function public.is_gallery(v jsonb) returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'array' and jsonb_array_length(v) <= 12 and not exists (
    select 1 from jsonb_array_elements(v) u
    where jsonb_typeof(u) <> 'string'
       or char_length(u #>> '{}') > 500
       or (u #>> '{}') !~ '^https://[^ ]+/storage/v1/object/public/event-gallery/[A-Za-z0-9/_.-]+$') $$;

revoke all on function public.is_people(jsonb), public.is_outline(jsonb), public.is_short_list(text[]),
  public.is_brochure(text), public.is_gallery(jsonb) from public;
grant execute on function public.is_people(jsonb), public.is_outline(jsonb), public.is_short_list(text[]),
  public.is_brochure(text), public.is_gallery(jsonb) to anon, authenticated, service_role;

-- ---------------------------------------------------------------- programs (content) and cohorts (each run)

alter table public.programs
  add column short_description text not null default '' check (char_length(short_description) <= 300),
  add column details       text not null default '' check (char_length(details) <= 20000),
  add column audience      text not null default '' check (char_length(audience) <= 300),
  add column outline       jsonb not null default '[]' check (public.is_outline(outline)),
  add column prerequisites text[] not null default '{}' check (public.is_short_list(prerequisites)),
  add column activities    text[] not null default '{}' check (public.is_short_list(activities)),
  add column hosts         jsonb not null default '[]' check (public.is_people(hosts)),
  add column guests        jsonb not null default '[]' check (public.is_people(guests)),
  add column brochure_url  text check (public.is_brochure(brochure_url));
update public.programs set short_description = left(description, 300) where short_description = '';

alter table public.cohorts
  add column ends_on        date,
  add column format         text check (format is null or format in ('Online', 'In person')),
  add column location       text check (location is null or char_length(location) <= 160),   -- null = TBA
  add column price_piasters int check (price_piasters is null or price_piasters between 0 and 1000000000),
  add constraint cohort_dates check (ends_on is null or starts_on is null or ends_on >= starts_on);

-- The Meet link for an online cohort: only enrolled learners and admins can read it. No row or no link = TBA.
create table public.cohort_links (
  cohort_id  uuid primary key references public.cohorts (id) on delete cascade,
  meet_url   text check (meet_url is null or (char_length(meet_url) <= 300 and meet_url ~ '^https://[^\s<>"]+$')),
  updated_at timestamptz not null default now()
);
create trigger cohort_links_touch before update on public.cohort_links for each row execute function public.touch_updated_at();
alter table public.cohort_links enable row level security;
create policy "Enrolled learners and admins read cohort links" on public.cohort_links
  for select to authenticated using (
    public.is_admin() or exists (
      select 1 from public.enrolments e where e.cohort_id = cohort_links.cohort_id and e.member_id = auth.uid() and e.status = 'confirmed'));
create policy "Admins write cohort links" on public.cohort_links
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.cohort_links from anon, authenticated;
grant select, insert, update, delete on public.cohort_links to authenticated;
grant all on public.cohort_links to service_role;

-- ---------------------------------------------------------------- masterclasses and shows

alter table public.events
  add column short_description text not null default '' check (char_length(short_description) <= 300),
  add column details       text not null default '' check (char_length(details) <= 20000),
  add column audience      text not null default '' check (char_length(audience) <= 300),
  add column outline       jsonb not null default '[]' check (public.is_outline(outline)),
  add column prerequisites text[] not null default '{}' check (public.is_short_list(prerequisites)),
  add column activities    text[] not null default '{}' check (public.is_short_list(activities)),
  add column host_list     jsonb not null default '[]' check (public.is_people(host_list)),
  add column guest_list    jsonb not null default '[]' check (public.is_people(guest_list)),
  add column ends_at       timestamptz,
  add column brochure_url  text check (public.is_brochure(brochure_url)),
  add column gallery       jsonb not null default '[]' check (public.is_gallery(gallery)),
  add constraint event_end_after_start check (ends_at is null or starts_at is null or ends_at >= starts_at);

-- Carry over existing text: first lines become the short description, single host/guest strings become list entries.
update public.events set short_description = left(split_part(coalesce(description, ''), E'\n', 1), 300) where short_description = '';
update public.events set host_list = (
    select coalesce(jsonb_agg(jsonb_build_object('name', left(btrim(h), 80), 'title', '')), '[]'::jsonb)
    from unnest(string_to_array(regexp_replace(hosts, '\s*(&|,| and )\s*', '|', 'g'), '|')) h where btrim(h) <> '')
  where hosts is not null and btrim(hosts) <> '' and host_list = '[]';
update public.events set guest_list = jsonb_build_array(jsonb_build_object('name', left(btrim(guest), 80), 'title', ''))
  where guest is not null and btrim(guest) <> '' and guest_list = '[]';

-- ---------------------------------------------------------------- services

alter table public.services drop constraint if exists services_audience_check;
alter table public.services add constraint services_audience_check check (char_length(audience) <= 300);
alter table public.services
  add column short_description text not null default '' check (char_length(short_description) <= 300),
  add column offerings     text[] not null default '{}' check (public.is_short_list(offerings)),
  add column prerequisites text[] not null default '{}' check (public.is_short_list(prerequisites)),
  add column brochure_url  text check (public.is_brochure(brochure_url));
update public.services set short_description = left(description, 300) where short_description = '';

-- ---------------------------------------------------------------- custom programs inbox (admin setting)

alter table public.site_settings drop constraint if exists site_settings_key_check;
alter table public.site_settings add constraint site_settings_key_check check (key in ('bank_details', 'refund_policy', 'custom_program_email'));
insert into public.site_settings (key, value) values ('custom_program_email', '') on conflict (key) do nothing;

-- ---------------------------------------------------------------- storage: brochures and show galleries (public read, admin write)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brochures', 'brochures', true, 10485760, array['application/pdf']),
       ('event-gallery', 'event-gallery', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins upload brochures and gallery photos" on storage.objects
  for insert to authenticated with check (bucket_id in ('brochures', 'event-gallery') and public.is_admin());
create policy "Admins replace brochures and gallery photos" on storage.objects
  for update to authenticated using (bucket_id in ('brochures', 'event-gallery') and public.is_admin())
  with check (bucket_id in ('brochures', 'event-gallery') and public.is_admin());
create policy "Admins delete brochures and gallery photos" on storage.objects
  for delete to authenticated using (bucket_id in ('brochures', 'event-gallery') and public.is_admin());
