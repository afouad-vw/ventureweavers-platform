-- Phase 12: "About you" sign-up details, Calendly bookings in the Requests inbox, content preview images.
-- Plan: docs/phase-12-plan.md.

-- ---------------------------------------------------------------- profiles

alter table public.profiles
  add column country       text check (country is null or char_length(country) between 2 and 60),
  add column linkedin      text check (linkedin is null or (char_length(linkedin) <= 200 and linkedin ~ '^https://www\.linkedin\.com/(in|company|school|pub)/[^\s<>"]+$')),
  add column contact_prefs text[] not null default '{}' check (contact_prefs <@ array['WhatsApp', 'Email', 'Call']::text[]);

-- Interests are now Education, Services, Content and QuidQuo (stored in goals). Carry over earlier answers.
update public.profiles set goals = array(
  select distinct case g
    when 'Learn with a cohort' then 'Education'
    when 'Hands-on help' then 'Services'
    when 'Shows & people' then 'Content'
    when 'Raise capital' then 'QuidQuo'
    else g end
  from unnest(goals) g)
where goals && array['Learn with a cohort', 'Hands-on help', 'Shows & people', 'Raise capital'];
update public.profiles set contact_prefs = array_remove(array['Email', case when consent_whatsapp then 'WhatsApp' end], null)
where contact_prefs = '{}';

-- ---------------------------------------------------------------- digital content preview image

alter table public.content_items add column image_url text check (public.is_content_image(image_url));

-- ---------------------------------------------------------------- Calendly

alter table public.site_settings drop constraint if exists site_settings_key_check;
alter table public.site_settings add constraint site_settings_key_check
  check (key in ('bank_details', 'refund_policy', 'custom_program_email', 'calendly_url'));
insert into public.site_settings (key, value) values ('calendly_url', '') on conflict (key) do nothing;

-- TVS custom programs can be requested too.
alter table public.services drop constraint if exists services_space_check;
alter table public.services add constraint services_space_check check (space in ('BRICKR', 'Outloud', 'TVS'));
alter table public.requests drop constraint if exists requests_space_check;
alter table public.requests add constraint requests_space_check check (space in ('BRICKR', 'Outloud', 'TVS'));

alter table public.requests
  add column calendly_event   text check (calendly_event is null or calendly_event ~ '^https://api\.calendly\.com/scheduled_events/[A-Za-z0-9-]{8,64}$'),
  add column calendly_invitee text unique check (calendly_invitee is null or calendly_invitee ~ '^https://api\.calendly\.com/scheduled_events/[A-Za-z0-9-]{8,64}/invitees/[A-Za-z0-9-]{8,64}$'),
  add column cancelled_at     timestamptz;

-- A booking made in Calendly from inside the platform becomes a request in the inbox.
-- The usual request rules apply (published service, open-request and daily limits); one request per Calendly booking.
create or replace function public.record_calendly_booking(
  p_service uuid, p_event text, p_invitee text, p_start timestamptz, p_join text, p_note text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); rid uuid;
begin
  if me is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if p_invitee is null or p_invitee !~ '^https://api\.calendly\.com/scheduled_events/[A-Za-z0-9-]{8,64}/invitees/[A-Za-z0-9-]{8,64}$' then
    raise exception 'bad_booking' using errcode = '22023';
  end if;
  select id into rid from public.requests where calendly_invitee = p_invitee;
  if rid is not null then return rid; end if;
  insert into public.requests (member_id, service_id, preferred_at, note)
  values (me, p_service, now() + interval '1 minute', left(coalesce(p_note, ''), 1000))
  returning id into rid;
  update public.requests set
    preferred_at = case when p_start between now() - interval '1 day' and now() + interval '1 year' then p_start else preferred_at end,
    meeting_at = case when p_start between now() - interval '1 day' and now() + interval '1 year' then p_start end,
    meeting_url = case when p_join ~ '^https://[^\s<>"]+$' and char_length(p_join) <= 300 then p_join end,
    calendly_event = case when p_event ~ '^https://api\.calendly\.com/scheduled_events/[A-Za-z0-9-]{8,64}$' then p_event end,
    calendly_invitee = p_invitee
  where id = rid;
  return rid;
end $$;
revoke all on function public.record_calendly_booking(uuid, text, text, timestamptz, text, text) from public;
grant execute on function public.record_calendly_booking(uuid, text, text, timestamptz, text, text) to authenticated;

-- The service for TVS custom program requests (hidden from the BRICKR list).
insert into public.services (slug, name, space, audience, short_description, description, status, sort)
values ('custom-program', 'Custom program', 'TVS', 'Teams, portfolios, cohorts and organisations',
        'A program shaped around your people.', 'A program shaped around your people.', 'published', 900)
on conflict (slug) do nothing;
