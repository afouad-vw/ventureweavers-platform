-- Phase 16 (approved 2026-11-17), step 2 of 2. Plan: docs/phase-16-plan.md.
-- 1. Each service chooses how members meet us: a meeting request, booking from that service's Calendly, or both.
-- 2. "Coming soon" for services, programs and events, with "Notify me" waitlists. When an item goes live,
--    everyone on its list gets a bell notification (here) and an email (sent by the app, see waitlist emailed_at).
-- 3. TVS: "Custom program" becomes "Private program"; a hidden "Private class" service for masterclasses.
-- Enum literals are compared as text so this file also runs in one transaction with step 1.

-- ================================================================ 1. booking per service

alter table public.services
  add column booking text not null default 'request' check (booking in ('request', 'calendar', 'both')),
  add column calendly_url text check (
    calendly_url is null or (char_length(calendly_url) <= 300 and calendly_url ~ '^https://calendly\.com/[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)?$')
  );
alter table public.services add constraint services_calendar_needs_link check (booking = 'request' or calendly_url is not null);

-- Nothing changes for members on day one: with the global link set, every service books from it.
update public.services s
   set booking = 'calendar', calendly_url = st.value
  from public.site_settings st
 where st.key = 'calendly_url' and st.value ~ '^https://calendly\.com/[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)?$';

-- ================================================================ 2. Coming soon

-- Programs: "In development" becomes "Coming soon".
alter table public.programs drop constraint if exists programs_status_check;
update public.programs set status = 'coming_soon' where status = 'in_development';
alter table public.programs add constraint programs_status_check check (status in ('draft', 'open', 'coming_soon', 'closed'));

-- Coming soon items are visible like published ones (same private-item rules). Booking, applying and
-- requesting keep checking for Published/Open in their own functions and triggers.
drop policy "Open and upcoming programs are public; private ones for invitees; admins see all" on public.programs;
create policy "Open and coming soon programs are public; private ones for invitees; admins see all" on public.programs for select to anon, authenticated using (
  (status = any (array['open', 'coming_soon']) and (visibility = 'public' or public.can_see_item('program', id)))
  or public.has_any_perm('{tvs.view,classroom.view,payments.view}'::text[]));

drop policy "Published events are public; private ones for invitees; admins see all" on public.events;
create policy "Published and coming soon events are public; private ones for invitees; admins see all" on public.events for select to anon, authenticated using (
  (status::text = any (array['published', 'coming_soon']) and (visibility = 'public' or public.can_see_item('event', id)))
  or public.has_any_perm('{events.view,tvs.view,live.manage,payments.view}'::text[]));

drop policy "Published services are public; private ones for invitees; admins see all" on public.services;
create policy "Published and coming soon services are public; private ones for invitees; admins see all" on public.services for select to anon, authenticated using (
  (status::text = any (array['published', 'coming_soon']) and (visibility = 'public' or public.can_see_item('service', id)))
  or public.has_any_perm('{brickr.view,requests.view}'::text[]));

-- ---------------------------------------------------------------- waitlists

create table public.waitlist_entries (
  id          uuid primary key default gen_random_uuid(),
  item_type   text not null check (item_type in ('service', 'program', 'event')),
  item_id     uuid not null,
  member_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  added_by    uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  notified_at timestamptz,
  emailed_at  timestamptz,
  unique (item_type, item_id, member_id)
);
create index waitlist_entries_item_idx on public.waitlist_entries (item_type, item_id, created_at desc);
create index waitlist_entries_unsent_idx on public.waitlist_entries (notified_at) where emailed_at is null and notified_at is not null;

-- Is this item Coming soon and visible to the signed-in member?
create or replace function public.waitlist_open(p_type text, p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'service' then exists (select 1 from public.services x where x.id = p_id and x.status::text = 'coming_soon'
                                and (x.visibility = 'public' or public.can_see_item('service', x.id)))
    when 'program' then exists (select 1 from public.programs x where x.id = p_id and x.status = 'coming_soon'
                                and (x.visibility = 'public' or public.can_see_item('program', x.id)))
    when 'event'   then exists (select 1 from public.events x where x.id = p_id and x.status::text = 'coming_soon'
                                and (x.visibility = 'public' or public.can_see_item('event', x.id)))
    else false end $$;

-- Members join for themselves: Coming soon items they can see, at most 30 joins a day.
create or replace function public.waitlist_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.notified_at := null;
  new.emailed_at := null;
  if new.added_by is null then
    if new.member_id is distinct from auth.uid() then raise exception 'not_allowed' using errcode = '42501'; end if;
    if not public.waitlist_open(new.item_type, new.item_id) then raise exception 'not_coming_soon' using errcode = '22023'; end if;
    if (select count(*) from public.waitlist_entries w where w.member_id = new.member_id and w.created_at > now() - interval '1 day') >= 30 then
      raise exception 'waitlist_limit' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
create trigger waitlist_before_insert before insert on public.waitlist_entries for each row execute function public.waitlist_before_insert();

alter table public.waitlist_entries enable row level security;
create policy "Members join waitlists for themselves" on public.waitlist_entries
  for insert to authenticated with check (member_id = auth.uid() and added_by is null);
create policy "Members see their own entries; staff see their areas" on public.waitlist_entries
  for select to authenticated using (member_id = auth.uid() or public.has_any_perm(public.item_view_perms(item_type)));
create policy "Members leave; staff with manage remove" on public.waitlist_entries
  for delete to authenticated using (member_id = auth.uid() or public.has_any_perm(public.item_manage_perms(item_type)));

revoke all on public.waitlist_entries from anon, authenticated;
grant select, delete on public.waitlist_entries to authenticated;
grant insert (item_type, item_id) on public.waitlist_entries to authenticated;
grant all on public.waitlist_entries to service_role;

-- Staff add members to a list (by account). Returns false if they were already on it.
create or replace function public.admin_add_to_waitlist(p_type text, p_id uuid, p_member uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_type not in ('service', 'program', 'event') or not public.has_any_perm(public.item_manage_perms(p_type)) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_member) or exists (select 1 from public.admin_users a where a.user_id = p_member) then
    raise exception 'not_member' using errcode = '22023';
  end if;
  insert into public.waitlist_entries (item_type, item_id, member_id, added_by)
  values (p_type, p_id, p_member, auth.uid())
  on conflict (item_type, item_id, member_id) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.admin_add_to_waitlist(text, uuid, uuid), public.waitlist_open(text, uuid) from public;
grant execute on function public.admin_add_to_waitlist(text, uuid, uuid), public.waitlist_open(text, uuid) to authenticated, service_role;

-- Going live: a bell notification for everyone on the list who hasn't been told yet (once only).
create or replace function public.waitlist_notify(p_type text, p_id uuid, p_text text, p_href text) returns void
language sql security definer set search_path = '' as $$
  with told as (
    update public.waitlist_entries set notified_at = now()
     where item_type = p_type and item_id = p_id and notified_at is null
    returning member_id
  )
  insert into public.notifications (member_id, text, href) select member_id, left(p_text, 300), p_href from told;
$$;
revoke all on function public.waitlist_notify(text, uuid, text, text) from public;

create or replace function public.services_go_live() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status::text = 'coming_soon' and new.status::text = 'published' then
    perform public.waitlist_notify('service', new.id, new.name || ' is now open.',
      case new.space when 'BRICKR' then '/brickr/services/' || new.slug when 'TVS' then '/tvs' else '/outloud' end);
  end if;
  return null;
end $$;
create trigger services_go_live after update of status on public.services for each row execute function public.services_go_live();

create or replace function public.events_go_live() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status::text = 'coming_soon' and new.status::text = 'published' then
    perform public.waitlist_notify('event', new.id, new.title || ' is now open for booking.',
      case when new.type::text = 'masterclass' then '/tvs/masterclasses/' else '/outloud/events/' end || new.slug);
  end if;
  return null;
end $$;
create trigger events_go_live after update of status on public.events for each row execute function public.events_go_live();

-- Programs: replaces the Phase 10 "Notify me" trigger (program_interest moves into waitlist_entries).
drop trigger if exists programs_notify on public.programs;
drop function if exists public.notify_program_open();
create or replace function public.programs_go_live() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'coming_soon' and new.status = 'open' then
    perform public.waitlist_notify('program', new.id, new.name || ' is now open for applications.', '/tvs/programs/' || new.slug);
  end if;
  return null;
end $$;
create trigger programs_go_live after update of status on public.programs for each row execute function public.programs_go_live();

-- Lists go when their item is deleted.
create or replace function public.waitlist_item_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.waitlist_entries where item_type = tg_argv[0] and item_id = old.id;
  return null;
end $$;
create trigger services_waitlist_cleanup after delete on public.services for each row execute function public.waitlist_item_deleted('service');
create trigger programs_waitlist_cleanup after delete on public.programs for each row execute function public.waitlist_item_deleted('program');
create trigger events_waitlist_cleanup after delete on public.events for each row execute function public.waitlist_item_deleted('event');

-- Earlier "Notify me" sign-ups for programs carry over.
insert into public.waitlist_entries (item_type, item_id, member_id, created_at, added_by)
select 'program', i.program_id, i.member_id, i.created_at, i.member_id from public.program_interest i
on conflict do nothing;
drop table public.program_interest;

-- ================================================================ 3. TVS private programs and classes

update public.services set name = 'Private program' where slug = 'custom-program' and name = 'Custom program';
insert into public.services (slug, name, space, audience, short_description, description, status, sort, booking, calendly_url)
select 'private-class', 'Private class', 'TVS', 'Teams, cohorts and communities',
       'A masterclass shaped around your people.', 'A masterclass shaped around your people.', 'published', 910,
       s.booking, s.calendly_url
  from public.services s where s.slug = 'custom-program'
on conflict (slug) do nothing;
