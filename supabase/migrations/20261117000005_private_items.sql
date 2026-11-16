-- Phase 15 (approved 2026-11-17), part 2: private items.
-- Programs, events (shows, masterclasses, private sessions), services, blog posts and Library resources can be
-- Private: only the people added from Contacts (members, or contacts matched by email when they join) can see them.

-- ================================================================ visibility

alter table public.programs          add column visibility text not null default 'public' check (visibility in ('public', 'private'));
alter table public.events            add column visibility text not null default 'public' check (visibility in ('public', 'private'));
alter table public.services          add column visibility text not null default 'public' check (visibility in ('public', 'private'));
alter table public.blog_posts        add column visibility text not null default 'public' check (visibility in ('public', 'private'));
alter table public.library_resources add column visibility text not null default 'public' check (visibility in ('public', 'private'));

-- ================================================================ who may see a private item

create table public.item_access (
  id         uuid primary key default gen_random_uuid(),
  item_type  text not null check (item_type in ('program', 'event', 'service', 'blog', 'resource')),
  item_id    uuid not null,
  member_id  uuid references auth.users (id) on delete cascade,
  email      text check (email is null or (email = lower(email) and char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+$')),
  name       text check (name is null or char_length(name) <= 120),
  added_by   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (member_id is not null or email is not null)
);
create unique index item_access_member_idx on public.item_access (item_type, item_id, member_id) where member_id is not null;
create unique index item_access_email_idx on public.item_access (item_type, item_id, email) where email is not null and member_id is null;
create index item_access_item_idx on public.item_access (item_type, item_id);

-- The admin area that manages each kind of item.
create or replace function public.item_manage_perms(p_type text) returns text[] language sql immutable set search_path = '' as $$
  select case p_type
    when 'program' then '{tvs.manage}'::text[]
    when 'event' then '{events.manage,tvs.manage}'::text[]
    when 'service' then '{brickr.manage}'::text[]
    when 'blog' then '{content.manage}'::text[]
    when 'resource' then '{library.manage}'::text[]
  end $$;
create or replace function public.item_view_perms(p_type text) returns text[] language sql immutable set search_path = '' as $$
  select case p_type
    when 'program' then '{tvs.view,classroom.view,payments.view}'::text[]
    when 'event' then '{events.view,tvs.view,live.manage,payments.view}'::text[]
    when 'service' then '{brickr.view,requests.view}'::text[]
    when 'blog' then '{content.view}'::text[]
    when 'resource' then '{library.view}'::text[]
  end $$;

alter table public.item_access enable row level security;
create policy "Members see their own access; staff see their areas" on public.item_access
  for select to authenticated using (member_id = auth.uid() or public.has_any_perm(public.item_view_perms(item_type)));
grant select on public.item_access to authenticated;
-- Writes go through admin_set_item_access() only.

-- True when the signed-in member was added to the item (by account, or by the email they signed up with).
create or replace function public.can_see_item(p_type text, p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.item_access a
    where a.item_type = p_type and a.item_id = p_id
      and (a.member_id = auth.uid() or (a.member_id is null and a.email = (select lower(u.email) from auth.users u where u.id = auth.uid())))) $$;
revoke all on function public.can_see_item(text, uuid), public.item_manage_perms(text), public.item_view_perms(text) from public;
grant execute on function public.can_see_item(text, uuid), public.item_manage_perms(text), public.item_view_perms(text) to anon, authenticated, service_role;

-- ================================================================ read rules: private items only for the people added

drop policy "Open and upcoming programs are public; admins see all" on public.programs;
create policy "Open and upcoming programs are public; private ones for invitees; admins see all" on public.programs for select to anon, authenticated using (
  (status = any (array['open', 'in_development']) and (visibility = 'public' or public.can_see_item('program', id)))
  or public.has_any_perm('{tvs.view,classroom.view,payments.view}'::text[]));

drop policy "Published events are public; admins see all" on public.events;
create policy "Published events are public; private ones for invitees; admins see all" on public.events for select to anon, authenticated using (
  (status = 'published' and (visibility = 'public' or public.can_see_item('event', id)))
  or public.has_any_perm('{events.view,tvs.view,live.manage,payments.view}'::text[]));

drop policy "Published services are public; admins see all" on public.services;
create policy "Published services are public; private ones for invitees; admins see all" on public.services for select to anon, authenticated using (
  (status = 'published' and (visibility = 'public' or public.can_see_item('service', id)))
  or public.has_any_perm('{brickr.view,requests.view}'::text[]));

drop policy "Published blog posts are public; admins see all" on public.blog_posts;
create policy "Published blog posts are public; private ones for invitees; admins see all" on public.blog_posts for select to anon, authenticated using (
  (status = 'published' and (visibility = 'public' or public.can_see_item('blog', id)))
  or public.has_any_perm('{content.view}'::text[]));

drop policy "Members see published resources; admins see all" on public.library_resources;
create policy "Members see published resources; private ones for invitees; admins see all" on public.library_resources for select to authenticated using (
  (status = 'published' and (visibility = 'public' or public.can_see_item('resource', id)))
  or public.has_any_perm('{library.view}'::text[]));

-- ================================================================ no booking, applying or requesting what you can't see

create or replace function public.guard_private_target() returns trigger
language plpgsql security definer set search_path = '' as $$
declare kind text; target uuid; vis text;
begin
  -- Staff and the server act on behalf of members; members only reach items they can see.
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_table_name = 'bookings' then kind := 'event'; target := new.event_id; select visibility into vis from public.events where id = target;
  elsif tg_table_name = 'applications' then kind := 'program'; target := new.program_id; select visibility into vis from public.programs where id = target;
  elsif tg_table_name = 'requests' then kind := 'service'; target := new.service_id; select visibility into vis from public.services where id = target;
  end if;
  if vis = 'private' and not public.can_see_item(kind, target) then raise exception 'not_found' using errcode = 'P0002'; end if;
  return new;
end $$;
create trigger bookings_guard_private before insert on public.bookings for each row execute function public.guard_private_target();
create trigger applications_guard_private before insert on public.applications for each row execute function public.guard_private_target();
create trigger requests_guard_private before insert on public.requests for each row execute function public.guard_private_target();

create or replace function public.open_resource(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.library_resources;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into r from public.library_resources where id = p_id;
  if not found or (r.status <> 'published' and not public.is_admin()) then raise exception 'not_found'; end if;
  if r.visibility = 'private' and not public.is_admin() and not public.can_see_item('resource', r.id) then raise exception 'not_found'; end if;
  if not public.is_admin() and not (r.access = any (public.my_access_levels())) then raise exception 'locked'; end if;
  if r.file_path is null and r.link_url is null then raise exception 'no_file'; end if;
  return jsonb_build_object('file_path', r.file_path, 'file_name', r.file_name, 'link_url', r.link_url);
end $$;

-- ================================================================ staff set who can see an item

-- p_people: [{ "member_id": uuid | null, "email": text | null, "name": text }]. Replaces the list.
-- Newly added members get a bell notification (p_notify) linking to p_href. Returns who was newly added.
create or replace function public.admin_set_item_access(p_type text, p_id uuid, p_people jsonb, p_title text, p_href text, p_notify boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  x jsonb; mid uuid; em text; nm text;
  want_members uuid[] := '{}'; want_emails text[] := '{}';
  added jsonb := '[]'::jsonb;
  before_list jsonb; after_list jsonb;
begin
  if p_type not in ('program', 'event', 'service', 'blog', 'resource') then raise exception 'bad_type' using errcode = '22023'; end if;
  if not public.has_any_perm(public.item_manage_perms(p_type)) then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_people is null or jsonb_typeof(p_people) <> 'array' or jsonb_array_length(p_people) > 500 then raise exception 'bad_people' using errcode = '22023'; end if;
  if p_href is not null and p_href !~ '^/[A-Za-z0-9/_?=&.-]*$' then raise exception 'bad_href' using errcode = '22023'; end if;

  select coalesce(jsonb_agg(coalesce(member_id::text, email) order by coalesce(member_id::text, email)), '[]') into before_list
    from public.item_access where item_type = p_type and item_id = p_id;

  for x in select value from jsonb_array_elements(p_people) loop
    mid := nullif(x->>'member_id', '')::uuid;
    em := nullif(lower(trim(coalesce(x->>'email', ''))), '');
    nm := left(nullif(trim(coalesce(x->>'name', '')), ''), 120);
    -- A contact who has since joined is stored by account.
    if mid is null and em is not null then select u.id into mid from auth.users u where lower(u.email) = em limit 1; end if;
    if mid is not null then
      if exists (select 1 from public.admin_users where user_id = mid) or mid = any (want_members) then continue; end if;
      want_members := want_members || mid;
      if not exists (select 1 from public.item_access where item_type = p_type and item_id = p_id and member_id = mid) then
        insert into public.item_access (item_type, item_id, member_id, name, added_by) values (p_type, p_id, mid, nm, me);
        added := added || jsonb_build_object('member_id', mid, 'name', nm);
        if p_notify and p_href is not null then
          perform public.notify(mid, 'You''re invited: ' || left(coalesce(p_title, 'a private item'), 200), p_href);
        end if;
      end if;
    elsif em is not null then
      if em = any (want_emails) then continue; end if;
      want_emails := want_emails || em;
      if not exists (select 1 from public.item_access where item_type = p_type and item_id = p_id and member_id is null and email = em) then
        insert into public.item_access (item_type, item_id, email, name, added_by) values (p_type, p_id, em, nm, me);
        added := added || jsonb_build_object('email', em, 'name', nm);
      end if;
    end if;
  end loop;

  delete from public.item_access a where a.item_type = p_type and a.item_id = p_id
    and not ((a.member_id is not null and a.member_id = any (want_members)) or (a.member_id is null and a.email = any (want_emails)));

  select coalesce(jsonb_agg(coalesce(member_id::text, email) order by coalesce(member_id::text, email)), '[]') into after_list
    from public.item_access where item_type = p_type and item_id = p_id;
  if before_list is distinct from after_list then
    insert into public.audit_log (actor, action, entity, entity_id, before, after)
    values (me, 'access.update', p_type, p_id::text, jsonb_build_object('people', before_list), jsonb_build_object('people', after_list));
  end if;
  return added;
end $$;
revoke all on function public.admin_set_item_access(text, uuid, jsonb, text, text, boolean) from public;
grant execute on function public.admin_set_item_access(text, uuid, jsonb, text, text, boolean) to authenticated;

-- Deleting an item removes its access list.
create or replace function public.item_access_cleanup() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.item_access where item_id = old.id and item_type = tg_argv[0];
  return old;
end $$;
create trigger programs_access_cleanup after delete on public.programs for each row execute function public.item_access_cleanup('program');
create trigger events_access_cleanup after delete on public.events for each row execute function public.item_access_cleanup('event');
create trigger services_access_cleanup after delete on public.services for each row execute function public.item_access_cleanup('service');
create trigger blog_access_cleanup after delete on public.blog_posts for each row execute function public.item_access_cleanup('blog');
create trigger resources_access_cleanup after delete on public.library_resources for each row execute function public.item_access_cleanup('resource');
