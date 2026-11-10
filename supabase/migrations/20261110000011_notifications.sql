-- Phase 10: notifications bell for members, and admin sign-in without 2-step.
-- Plan: docs/phase-10-plan.md.

-- ---------------------------------------------------------------- admins: no 2-step requirement

-- Admin rights come only from being listed in admin_users (2-step removed at Ahmed's request, 2026-11-10).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users a where a.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------- notifications

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references auth.users (id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 300),
  href       text not null default '/my-space' check (href ~ '^/[A-Za-z0-9/_?=&%.-]*$' and char_length(href) <= 200),
  created_at timestamptz not null default clock_timestamp(),
  read_at    timestamptz
);
create index notifications_member_idx on public.notifications (member_id, created_at desc);

alter table public.notifications enable row level security;
create policy "Members read their own notifications" on public.notifications
  for select to authenticated using (member_id = auth.uid());
create policy "Members mark their own notifications read" on public.notifications
  for update to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- Helpers used only by the triggers below.
create or replace function public.notify(p_member uuid, p_text text, p_href text) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (member_id, text, href) values (p_member, left(p_text, 300), p_href);
$$;

create or replace function public.cairo_when(t timestamptz) returns text
language sql immutable set search_path = '' as $$
  select to_char(t at time zone 'Africa/Cairo', 'Dy DD Mon, HH24:MI');
$$;

create or replace function public.egp(p int) returns text
language sql immutable set search_path = '' as $$
  select 'EGP ' || case when p % 100 = 0 then to_char(p / 100, 'FM999,999,999') else to_char(p / 100.0, 'FM999,999,990.00') end;
$$;

-- ---------------------------------------------------------------- seats

create or replace function public.notify_booking() returns trigger
language plpgsql security definer set search_path = '' as $$
declare title text;
begin
  select e.title into title from public.events e where e.id = new.event_id;
  if tg_op = 'INSERT' then
    if new.status = 'confirmed' then
      perform public.notify(new.member_id, 'Your seat for ' || title || ' is confirmed.', '/my-space');
    elsif new.status = 'reserved' then
      perform public.notify(new.member_id, 'Seat reserved for ' || title || '. Transfer '
        || public.egp(new.amount_piasters) || coalesce(' by ' || public.cairo_when(new.hold_expires_at), '')
        || ' with ' || new.pay_reference || '.', '/my-space');
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'confirmed' then
      perform public.notify(new.member_id, 'Your seat for ' || title || ' is confirmed.', '/my-space');
    elsif new.status in ('cancelled', 'refunded') and old.status in ('reserved', 'confirmed')
          and new.closed_by is distinct from new.member_id then
      perform public.notify(new.member_id, 'Your booking for ' || title || ' was '
        || case when new.status = 'refunded' then 'cancelled and refunded.' else 'cancelled.' end, '/my-space');
    end if;
  end if;
  return null;
end $$;
create trigger bookings_notify after insert or update of status on public.bookings
  for each row execute function public.notify_booking();

-- ---------------------------------------------------------------- programs

create or replace function public.notify_enrolment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare prog text; label text;
begin
  select p.name, c.label into prog, label from public.cohorts c join public.programs p on p.id = c.program_id where c.id = new.cohort_id;
  if (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if new.status = 'offered' then
      perform public.notify(new.member_id, 'You''re offered a seat in ' || prog || ' · ' || label || '.', '/my-space?tab=learning');
    elsif new.status = 'confirmed' then
      perform public.notify(new.member_id, 'You''re enrolled in ' || prog || '. The classroom is open.', '/tvs/classroom');
    end if;
  end if;
  return null;
end $$;
create trigger enrolments_notify after insert or update of status on public.enrolments
  for each row execute function public.notify_enrolment();

create or replace function public.notify_application() returns trigger
language plpgsql security definer set search_path = '' as $$
declare prog text;
begin
  if new.status is not distinct from old.status then return null; end if;
  select p.name into prog from public.programs p where p.id = new.program_id;
  if new.status = 'intro_call' then
    perform public.notify(new.member_id, 'Your ' || prog || ' application moved to Intro call. We''ll be in touch to book it.', '/my-space?tab=learning');
  elsif new.status = 'declined' then
    perform public.notify(new.member_id, 'Your ' || prog || ' application wasn''t taken forward this time.', '/my-space?tab=learning');
  end if;
  return null;
end $$;
create trigger applications_notify after update of status on public.applications
  for each row execute function public.notify_application();

create or replace function public.notify_submission() returns trigger
language plpgsql security definer set search_path = '' as $$
declare title text;
begin
  if new.status is not distinct from old.status then return null; end if;
  select a.title into title from public.assignments a where a.id = new.assignment_id;
  if new.status = 'reviewed' then
    perform public.notify(new.member_id, 'Your hand-in for ' || title || ' was reviewed.', '/tvs/classroom');
  else
    perform public.notify(new.member_id, 'Your hand-in for ' || title || ' was reopened. You can hand in again.', '/tvs/classroom');
  end if;
  return null;
end $$;
create trigger submissions_notify after update of status on public.submissions
  for each row execute function public.notify_submission();

-- A program members asked to hear about opens.
create or replace function public.notify_program_open() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'open' and old.status is distinct from 'open' then
    insert into public.notifications (member_id, text, href)
    select i.member_id, left(new.name || ' is now open for applications.', 300), '/tvs'
      from public.program_interest i where i.program_id = new.id;
  end if;
  return null;
end $$;
create trigger programs_notify after update of status on public.programs
  for each row execute function public.notify_program_open();

-- ---------------------------------------------------------------- BRICKR and private sessions

create or replace function public.notify_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare svc text;
begin
  if new.meeting_at is not null and new.meeting_at is distinct from old.meeting_at then
    select s.name into svc from public.services s where s.id = new.service_id;
    perform public.notify(new.member_id, 'Meeting confirmed: ' || svc || ', ' || public.cairo_when(new.meeting_at) || ' (Cairo).', '/my-space?tab=requests');
  end if;
  return null;
end $$;
create trigger requests_notify after update of meeting_at on public.requests
  for each row execute function public.notify_request();

-- ---------------------------------------------------------------- payment requests

create or replace function public.notify_payment_request() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.member_id, 'New payment request: ' || new.item || ', ' || public.egp(new.amount_piasters) || '.', '/my-space?tab=payments');
  elsif new.status is distinct from old.status then
    perform public.notify(new.member_id, case new.status
      when 'paid' then 'Payment received for ' || new.item || '. Thank you.'
      when 'refunded' then 'Refund recorded for ' || new.item || '.'
      else 'Payment request for ' || new.item || ' was cancelled.' end, '/my-space?tab=payments');
  end if;
  return null;
end $$;
create trigger payment_requests_notify after insert or update of status on public.payment_requests
  for each row execute function public.notify_payment_request();

-- ---------------------------------------------------------------- live mode

create or replace function public.notify_live_open() returns trigger
language plpgsql security definer set search_path = '' as $$
declare title text;
begin
  if new.is_open and (tg_op = 'INSERT' or not old.is_open) then
    select e.title into title from public.events e where e.id = new.event_id;
    insert into public.notifications (member_id, text, href)
    select distinct b.member_id, left('Live mode is open for ' || title || '. Ask, vote and follow the show.', 300), '/live?event=' || new.event_id
      from public.bookings b where b.event_id = new.event_id and b.status = 'confirmed';
  end if;
  return null;
end $$;
create trigger live_sessions_notify after insert or update of is_open on public.live_sessions
  for each row execute function public.notify_live_open();

revoke all on function public.notify(uuid, text, text), public.cairo_when(timestamptz), public.egp(int),
  public.notify_booking(), public.notify_enrolment(), public.notify_application(), public.notify_submission(),
  public.notify_program_open(), public.notify_request(), public.notify_payment_request(), public.notify_live_open() from public;
