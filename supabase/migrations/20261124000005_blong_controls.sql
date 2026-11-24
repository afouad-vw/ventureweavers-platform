-- Phase 19a (approved 2026-11-24): BLong admin controls. Plan: docs/phase-19-plan.md.
-- 1. Section switches: the team turns Communities and/or Discussions off; members see Coming soon and Notify me,
--    and every function refuses with section_off (content is kept).
-- 2. Approval: new communities and discussions start Pending (only the creator sees them) until the team approves.
--    Declined ones can be edited and resubmitted once.
-- 3. Settings and analysis for staff with the Community area.
-- Existing member functions are kept and wrapped: each is renamed to <name>__base (no grants) and a function with the
-- original name checks the switches and the review state first.

-- ================================================================ settings

create table public.blong_settings (
  id                  int primary key default 1 check (id = 1),
  communities_on      boolean not null default true,
  discussions_on      boolean not null default true,
  approve_communities boolean not null default true,
  approve_discussions boolean not null default true,
  updated_by          uuid references auth.users (id) on delete set null,
  updated_at          timestamptz not null default now()
);
insert into public.blong_settings (id) values (1);
alter table public.blong_settings enable row level security;
-- No direct access: members read the switches through blong_sections(), staff through blong_admin_settings().
revoke all on public.blong_settings from anon, authenticated;
grant all on public.blong_settings to service_role;

-- Fixed ids for the two sections' Notify me lists.
create or replace function public.blong_section_id(k text) returns uuid language sql immutable set search_path = '' as $$
  select case k when 'communities' then '00000000-0000-0000-0000-00000000b101'::uuid
                when 'discussions' then '00000000-0000-0000-0000-00000000b102'::uuid end $$;

create or replace function public.blong_on(k text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case k when 'communities' then s.communities_on when 'discussions' then s.discussions_on else true end
  from public.blong_settings s where s.id = 1;
$$;

create or replace function public.blong_need(k text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce(public.blong_on(k), true) then raise exception 'section_off' using errcode = '22023'; end if;
end $$;

-- For the member app: which sections are open.
create or replace function public.blong_sections() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('communities', communities_on, 'discussions', discussions_on) from public.blong_settings where id = 1;
$$;

-- ================================================================ review state

alter table public.communities drop constraint communities_status_check;
alter table public.communities add constraint communities_status_check check (status in ('active', 'archived', 'pending', 'declined'));
alter table public.communities
  add column review_note  text check (review_note is null or char_length(review_note) <= 1000),
  add column reviewed_by  uuid references auth.users (id) on delete set null,
  add column reviewed_at  timestamptz,
  add column resubmitted  boolean not null default false;

alter table public.discussions drop constraint discussions_status_check;
alter table public.discussions add constraint discussions_status_check check (status in ('open', 'closed', 'archived', 'pending', 'declined'));
alter table public.discussions
  add column review_note  text check (review_note is null or char_length(review_note) <= 1000),
  add column reviewed_by  uuid references auth.users (id) on delete set null,
  add column reviewed_at  timestamptz,
  add column resubmitted  boolean not null default false;

-- A community that's live for members: section on, approved and not archived; otherwise section_off or pending_review.
create or replace function public.cm_need_live(p_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare st text;
begin
  perform public.blong_need('communities');
  select status into st from public.communities where id = p_id;
  if st in ('pending', 'declined') then raise exception 'pending_review' using errcode = '22023'; end if;
end $$;

create or replace function public.dr_need_live(p_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare d public.discussions;
begin
  perform public.blong_need('discussions');
  select * into d from public.discussions where id = p_id;
  if d.community_id is not null then perform public.blong_need('communities'); end if;
  if d.status in ('pending', 'declined') then raise exception 'pending_review' using errcode = '22023'; end if;
end $$;

-- Rooms: also hidden while their section (or their community's) is off, and Pending/Declined ones only for their creator.
create or replace function public.dr_can_find(p_room uuid, p_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.discussions d
    where d.id = p_room
      and public.blong_member(p_member)
      and public.blong_on('discussions')
      and (d.community_id is null or public.blong_on('communities'))
      and (d.status <> 'archived' or public.dr_is_admin(d.id, p_member))
      and (d.status not in ('pending', 'declined') or d.owner = p_member)
      and (d.community_id is null or public.cm_role(d.community_id, p_member) is not null or public.dr_role(d.id, p_member) is not null)
      and (d.privacy <> 'invite' or exists (select 1 from public.discussion_members m where m.discussion_id = d.id and m.member_id = p_member))
      and not public.blong_blocked(p_member, d.owner));
$$;

drop policy "Members find active communities; owners and Community staff see archived ones" on public.communities;
create policy "Members find live communities; owners see their own; Community staff see all" on public.communities
  for select to authenticated using (
    (public.blong_on('communities') and (status = 'active' or owner = auth.uid() or public.cm_is_admin(id, auth.uid())))
    or public.has_any_perm('{community.view}'::text[]));

-- ================================================================ wrapped community functions

alter function public.create_community(text, text, text, text[], text[], text, text) rename to create_community__base;
alter function public.update_community(uuid, text, text, text, text[], text[], text, text) rename to update_community__base;
alter function public.set_community_status(uuid, text) rename to set_community_status__base;
alter function public.join_community(uuid) rename to join_community__base;
alter function public.leave_community(uuid) rename to leave_community__base;
alter function public.respond_join(uuid, uuid, boolean) rename to respond_join__base;
alter function public.invite_to_community(uuid, uuid) rename to invite_to_community__base;
alter function public.set_community_role(uuid, uuid, text) rename to set_community_role__base;
alter function public.remove_community_member(uuid, uuid) rename to remove_community_member__base;
alter function public.transfer_community(uuid, uuid) rename to transfer_community__base;
alter function public.list_communities(text, text, text) rename to list_communities__base;
alter function public.community_page(text) rename to community_page__base;
alter function public.community_people(uuid) rename to community_people__base;
revoke all on function
  public.create_community__base(text, text, text, text[], text[], text, text), public.update_community__base(uuid, text, text, text, text[], text[], text, text),
  public.set_community_status__base(uuid, text), public.join_community__base(uuid), public.leave_community__base(uuid),
  public.respond_join__base(uuid, uuid, boolean), public.invite_to_community__base(uuid, uuid), public.set_community_role__base(uuid, uuid, text),
  public.remove_community_member__base(uuid, uuid), public.transfer_community__base(uuid, uuid),
  public.list_communities__base(text, text, text), public.community_page__base(text), public.community_people__base(uuid)
  from public, anon, authenticated;

create or replace function public.create_community(
  p_name text, p_description text, p_type text, p_topics text[], p_audience text[], p_visibility text, p_cover text default null
) returns text language plpgsql security definer set search_path = '' as $$
declare s text;
begin
  perform public.blong_need('communities');
  s := public.create_community__base(p_name, p_description, p_type, p_topics, p_audience, p_visibility, p_cover);
  if (select approve_communities from public.blong_settings where id = 1) then
    update public.communities set status = 'pending' where slug = s;
  end if;
  return s;
end $$;

-- Editing a Declined community sends it back for review once.
create or replace function public.update_community(
  p_id uuid, p_name text, p_description text, p_type text, p_topics text[], p_audience text[], p_visibility text, p_cover text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.blong_need('communities');
  perform public.update_community__base(p_id, p_name, p_description, p_type, p_topics, p_audience, p_visibility, p_cover);
  update public.communities set status = 'pending', resubmitted = true where id = p_id and status = 'declined' and not resubmitted;
end $$;

create or replace function public.set_community_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_any_perm('{community.manage}'::text[]) then perform public.cm_need_live(p_id); end if;
  if (select status from public.communities where id = p_id) in ('pending', 'declined') then raise exception 'pending_review' using errcode = '22023'; end if;
  perform public.set_community_status__base(p_id, p_status);
end $$;

create or replace function public.join_community(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
begin perform public.cm_need_live(p_id); return public.join_community__base(p_id); end $$;

create or replace function public.leave_community(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin perform public.blong_need('communities'); perform public.leave_community__base(p_id); end $$;

create or replace function public.respond_join(p_id uuid, p_member uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin perform public.cm_need_live(p_id); perform public.respond_join__base(p_id, p_member, p_accept); end $$;

create or replace function public.invite_to_community(p_id uuid, p_member uuid) returns text
language plpgsql security definer set search_path = '' as $$
begin perform public.cm_need_live(p_id); return public.invite_to_community__base(p_id, p_member); end $$;

create or replace function public.set_community_role(p_id uuid, p_member uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin perform public.cm_need_live(p_id); perform public.set_community_role__base(p_id, p_member, p_role); end $$;

create or replace function public.remove_community_member(p_id uuid, p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin perform public.cm_need_live(p_id); perform public.remove_community_member__base(p_id, p_member); end $$;

create or replace function public.transfer_community(p_id uuid, p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin perform public.cm_need_live(p_id); perform public.transfer_community__base(p_id, p_member); end $$;

create or replace function public.list_communities(p_scope text default 'explore', p_q text default null, p_type text default null)
returns table (id uuid, slug text, name text, description text, type text, topics text[], audience text[], visibility text,
               cover_url text, status text, members int, my_role text, my_status text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from public.list_communities__base(p_scope, p_q, p_type) where public.blong_on('communities');
$$;

-- The page adds the review note for the people who run the community and for staff.
create or replace function public.community_page(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  j jsonb;
  c public.communities;
  staff boolean := public.has_any_perm('{community.view}'::text[]);
begin
  if not public.blong_on('communities') and not staff then return null; end if;
  j := public.community_page__base(p_slug);
  if j is null then return null; end if;
  select * into c from public.communities where id = (j ->> 'id')::uuid;
  -- Pending, declined and archived communities: only the people who run them and staff (the base check let a
  -- non-member through, because its "not member" test was null for people with no membership row).
  if c.status <> 'active' and not public.cm_is_admin(c.id, auth.uid()) and not staff then return null; end if;
  if staff or public.cm_is_admin(c.id, auth.uid()) then
    j := j || jsonb_build_object('review_note', c.review_note, 'resubmitted', c.resubmitted);
  end if;
  return j;
end $$;

create or replace function public.community_people(p_id uuid)
returns table (id uuid, name text, avatar_url text, roles text[], role text, status text, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from public.community_people__base(p_id) where public.blong_on('communities');
$$;

-- ================================================================ wrapped discussion functions

alter function public.create_discussion(text, text, text, text[], int, text, uuid) rename to create_discussion__base;
alter function public.update_discussion(uuid, text, text, text, text[], int, text) rename to update_discussion__base;
alter function public.set_discussion_status(uuid, text) rename to set_discussion_status__base;
alter function public.join_discussion(uuid) rename to join_discussion__base;
alter function public.leave_discussion(uuid) rename to leave_discussion__base;
alter function public.respond_discussion_join(uuid, uuid, boolean) rename to respond_discussion_join__base;
alter function public.invite_to_discussion(uuid, uuid) rename to invite_to_discussion__base;
alter function public.set_discussion_role(uuid, uuid, text) rename to set_discussion_role__base;
alter function public.remove_discussion_member(uuid, uuid) rename to remove_discussion_member__base;
alter function public.transfer_discussion(uuid, uuid) rename to transfer_discussion__base;
alter function public.post_room_message(uuid, text, uuid) rename to post_room_message__base;
alter function public.remove_room_message(uuid) rename to remove_room_message__base;
alter function public.pin_room_message(uuid, uuid) rename to pin_room_message__base;
alter function public.discussion_page(text) rename to discussion_page__base;
revoke all on function
  public.create_discussion__base(text, text, text, text[], int, text, uuid), public.update_discussion__base(uuid, text, text, text, text[], int, text),
  public.set_discussion_status__base(uuid, text), public.join_discussion__base(uuid), public.leave_discussion__base(uuid),
  public.respond_discussion_join__base(uuid, uuid, boolean), public.invite_to_discussion__base(uuid, uuid), public.set_discussion_role__base(uuid, uuid, text),
  public.remove_discussion_member__base(uuid, uuid), public.transfer_discussion__base(uuid, uuid),
  public.post_room_message__base(uuid, text, uuid), public.remove_room_message__base(uuid), public.pin_room_message__base(uuid, uuid),
  public.discussion_page__base(text)
  from public, anon, authenticated;

create or replace function public.create_discussion(
  p_title text, p_description text, p_category text, p_tags text[], p_limit int, p_privacy text, p_community uuid default null
) returns text language plpgsql security definer set search_path = '' as $$
declare s text;
begin
  perform public.blong_need('discussions');
  if p_community is not null then perform public.blong_need('communities'); end if;
  s := public.create_discussion__base(p_title, p_description, p_category, p_tags, p_limit, p_privacy, p_community);
  if (select approve_discussions from public.blong_settings where id = 1) then
    update public.discussions set status = 'pending' where slug = s;
  end if;
  return s;
end $$;

create or replace function public.update_discussion(
  p_id uuid, p_title text, p_description text, p_category text, p_tags text[], p_limit int, p_privacy text
) returns void language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  perform public.blong_need('discussions');
  select community_id into cid from public.discussions where id = p_id;
  if cid is not null then perform public.blong_need('communities'); end if;
  perform public.update_discussion__base(p_id, p_title, p_description, p_category, p_tags, p_limit, p_privacy);
  update public.discussions set status = 'pending', resubmitted = true where id = p_id and status = 'declined' and not resubmitted;
end $$;

create or replace function public.set_discussion_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_any_perm('{community.manage}'::text[]) then perform public.dr_need_live(p_id); end if;
  if (select status from public.discussions where id = p_id) in ('pending', 'declined') then raise exception 'pending_review' using errcode = '22023'; end if;
  perform public.set_discussion_status__base(p_id, p_status);
end $$;

create or replace function public.join_discussion(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
begin perform public.dr_need_live(p_id); return public.join_discussion__base(p_id); end $$;

create or replace function public.leave_discussion(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin perform public.dr_need_live(p_id); perform public.leave_discussion__base(p_id); end $$;

create or replace function public.respond_discussion_join(p_id uuid, p_member uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin perform public.dr_need_live(p_id); perform public.respond_discussion_join__base(p_id, p_member, p_accept); end $$;

create or replace function public.invite_to_discussion(p_id uuid, p_member uuid) returns text
language plpgsql security definer set search_path = '' as $$
begin perform public.dr_need_live(p_id); return public.invite_to_discussion__base(p_id, p_member); end $$;

create or replace function public.set_discussion_role(p_id uuid, p_member uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin perform public.dr_need_live(p_id); perform public.set_discussion_role__base(p_id, p_member, p_role); end $$;

create or replace function public.remove_discussion_member(p_id uuid, p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin perform public.dr_need_live(p_id); perform public.remove_discussion_member__base(p_id, p_member); end $$;

create or replace function public.transfer_discussion(p_id uuid, p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin perform public.dr_need_live(p_id); perform public.transfer_discussion__base(p_id, p_member); end $$;

create or replace function public.post_room_message(p_id uuid, p_body text, p_reply_to uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
begin perform public.dr_need_live(p_id); return public.post_room_message__base(p_id, p_body, p_reply_to); end $$;

create or replace function public.remove_room_message(p_message uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.dr_need_live((select discussion_id from public.discussion_messages where id = p_message));
  perform public.remove_room_message__base(p_message);
end $$;

create or replace function public.pin_room_message(p_id uuid, p_message uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin perform public.dr_need_live(p_id); perform public.pin_room_message__base(p_id, p_message); end $$;

create or replace function public.discussion_page(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  j jsonb;
  d public.discussions;
  staff boolean := public.has_any_perm('{community.view}'::text[]);
begin
  j := public.discussion_page__base(p_slug);
  if j is null then return null; end if;
  select * into d from public.discussions where id = (j ->> 'id')::uuid;
  -- The base page lets staff see every room; with the section off they still can, members can't (dr_can_find).
  if staff or public.dr_is_admin(d.id, auth.uid()) then
    j := j || jsonb_build_object('review_note', d.review_note, 'resubmitted', d.resubmitted);
  end if;
  return j;
end $$;

-- ================================================================ activity and feed leave out switched-off communities

alter function public.member_activity(uuid, int) rename to member_activity__base;
alter function public.blong_feed(int) rename to blong_feed__base;
revoke all on function public.member_activity__base(uuid, int), public.blong_feed__base(int) from public, anon, authenticated;

create or replace function public.member_activity(p_id uuid, p_limit int default 30)
returns table (kind text, verb text, title text, href text, at timestamptz, starts_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from public.member_activity__base(p_id, p_limit) a
  where not (a.href like '/blong/communities/%' and not public.blong_on('communities'));
$$;

create or replace function public.blong_feed(p_limit int default 60)
returns table (member_id uuid, name text, avatar_url text, kind text, verb text, title text, href text, at timestamptz, starts_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from public.blong_feed__base(p_limit) a
  where not (a.href like '/blong/communities/%' and not public.blong_on('communities'));
$$;

-- ================================================================ Notify me for a switched-off section

alter table public.waitlist_entries drop constraint waitlist_entries_item_type_check;
alter table public.waitlist_entries add constraint waitlist_entries_item_type_check check (item_type in ('service', 'program', 'event', 'blong_section'));

create or replace function public.waitlist_open(p_type text, p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_type
    when 'service' then exists (select 1 from public.services x where x.id = p_id and x.status::text = 'coming_soon'
                                and (x.visibility = 'public' or public.can_see_item('service', x.id)))
    when 'program' then exists (select 1 from public.programs x where x.id = p_id and x.status = 'coming_soon'
                                and (x.visibility = 'public' or public.can_see_item('program', x.id)))
    when 'event'   then exists (select 1 from public.events x where x.id = p_id and x.status::text = 'coming_soon'
                                and (x.visibility = 'public' or public.can_see_item('event', x.id)))
    when 'blong_section' then (p_id = public.blong_section_id('communities') and not public.blong_on('communities'))
                           or (p_id = public.blong_section_id('discussions') and not public.blong_on('discussions'))
    else false end $$;

create or replace function public.item_manage_perms(p_type text) returns text[] language sql immutable set search_path = '' as $$
  select case p_type
    when 'program' then '{tvs.manage}'::text[]
    when 'event' then '{events.manage,tvs.manage}'::text[]
    when 'service' then '{brickr.manage}'::text[]
    when 'blog' then '{content.manage}'::text[]
    when 'resource' then '{library.manage}'::text[]
    when 'blong_section' then '{community.manage}'::text[]
  end $$;
create or replace function public.item_view_perms(p_type text) returns text[] language sql immutable set search_path = '' as $$
  select case p_type
    when 'program' then '{tvs.view,classroom.view,payments.view}'::text[]
    when 'event' then '{events.view,tvs.view,live.manage,payments.view}'::text[]
    when 'service' then '{brickr.view,requests.view}'::text[]
    when 'blog' then '{content.view}'::text[]
    when 'resource' then '{library.view}'::text[]
    when 'blong_section' then '{community.view}'::text[]
  end $$;

-- Switching a section on tells everyone on its list once (bell); the app sends the email.
create or replace function public.blong_settings_go_live() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not old.communities_on and new.communities_on then
    perform public.waitlist_notify('blong_section', public.blong_section_id('communities'), 'BLong communities are open. Find your people.', '/blong/communities');
  end if;
  if not old.discussions_on and new.discussions_on then
    perform public.waitlist_notify('blong_section', public.blong_section_id('discussions'), 'BLong discussions are open. Join the conversation.', '/blong/discussions');
  end if;
  return null;
end $$;
create trigger blong_settings_go_live after update on public.blong_settings for each row execute function public.blong_settings_go_live();

-- ================================================================ staff: settings, approvals, analysis

create or replace function public.blong_admin_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_any_perm('{community.view}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  return (select to_jsonb(s) - 'id' from public.blong_settings s where s.id = 1);
end $$;

-- Changes only the keys given; every change goes to the audit log.
create or replace function public.set_blong_settings(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  was jsonb;
  now_ jsonb;
begin
  if not public.has_any_perm('{community.manage}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  select to_jsonb(s) into was from public.blong_settings s where s.id = 1;
  update public.blong_settings set
    communities_on      = coalesce((p ->> 'communities_on')::boolean, communities_on),
    discussions_on      = coalesce((p ->> 'discussions_on')::boolean, discussions_on),
    approve_communities = coalesce((p ->> 'approve_communities')::boolean, approve_communities),
    approve_discussions = coalesce((p ->> 'approve_discussions')::boolean, approve_discussions),
    updated_by = auth.uid(), updated_at = now()
  where id = 1;
  select to_jsonb(s) into now_ from public.blong_settings s where s.id = 1;
  insert into public.audit_log (actor, action, entity, entity_id, before, after)
    values (auth.uid(), 'blong.settings', 'blong_settings', '1', was, now_);
end $$;

-- Communities and discussions waiting for approval, oldest first.
create or replace function public.blong_pending()
returns table (kind text, id uuid, slug text, name text, description text, label text, privacy text, cover_url text,
               community text, owner_id uuid, owner_name text, resubmitted boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_any_perm('{community.view}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  return query
    select 'community'::text, c.id, c.slug, c.name, c.description, c.type, c.visibility, c.cover_url, null::text,
           c.owner, coalesce(nullif(btrim(p.full_name), ''), 'Member'), c.resubmitted, c.created_at
    from public.communities c join public.profiles p on p.id = c.owner where c.status = 'pending'
    union all
    select 'discussion', d.id, d.slug, d.title, d.description, d.category, d.privacy, null, co.name,
           d.owner, coalesce(nullif(btrim(p.full_name), ''), 'Member'), d.resubmitted, d.created_at
    from public.discussions d join public.profiles p on p.id = d.owner left join public.communities co on co.id = d.community_id
    where d.status = 'pending'
    order by 13;
end $$;

-- Approve (goes live) or decline with a note; the creator is told in their bell.
create or replace function public.review_blong_item(p_kind text, p_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  who uuid;
  v_title text;
  v_slug text;
  note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.has_any_perm('{community.manage}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  if not p_approve and note is null then raise exception 'note_needed' using errcode = '22023'; end if;
  if p_kind = 'community' then
    update public.communities set status = case when p_approve then 'active' else 'declined' end,
      review_note = case when p_approve then null else left(note, 1000) end, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id and status = 'pending' returning owner, name, slug into who, v_title, v_slug;
    if who is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    perform public.notify(who, case when p_approve then 'Your community ' || v_title || ' is live.'
                                    else 'Your community ' || v_title || ' wasn''t approved: ' || left(note, 160) end,
                          '/blong/communities/' || v_slug);
  elsif p_kind = 'discussion' then
    update public.discussions set status = case when p_approve then 'open' else 'declined' end,
      review_note = case when p_approve then null else left(note, 1000) end, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id and status = 'pending' returning owner, discussions.title, discussions.slug into who, v_title, v_slug;
    if who is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    perform public.notify(who, case when p_approve then 'Your discussion ' || v_title || ' is live.'
                                    else 'Your discussion ' || v_title || ' wasn''t approved: ' || left(note, 160) end,
                          '/blong/discussions/' || v_slug);
  else
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  insert into public.audit_log (actor, action, entity, entity_id, after)
    values (auth.uid(), case when p_approve then 'blong.approve' else 'blong.decline' end, p_kind, p_id::text, jsonb_build_object('note', note));
end $$;

-- Counts for Admin › Community › Overview. No message text, only numbers and community/discussion names.
create or replace function public.blong_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  since timestamptz := now() - interval '30 days';
  r jsonb;
begin
  if not public.has_any_perm('{community.view}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  with members as (
    select p.id, p.visibility from public.profiles p
    where not exists (select 1 from public.admin_users a where a.user_id = p.id)
      and not exists (select 1 from public.member_suspensions s where s.member_id = p.id)
  ),
  acts as (
    select author as who, created_at as at from public.discussion_messages
    union all select author, created_at from public.dm_messages
    union all select member_id, joined_at from public.community_members where joined_at is not null
    union all select member_id, joined_at from public.discussion_members where joined_at is not null
    union all select follower, created_at from public.follows
  ),
  days as (select generate_series(date_trunc('day', now() - interval '29 days'), date_trunc('day', now()), interval '1 day') as d)
  select jsonb_build_object(
    'members', (select count(*) from members),
    'public', (select count(*) from members where visibility = 'public'),
    'follows', (select count(*) from public.follows where status = 'accepted'),
    'follows_30', (select count(*) from public.follows where status = 'accepted' and created_at > since),
    'communities', (select jsonb_object_agg(status, n) from (select status, count(*) n from public.communities group by status) x),
    'discussions', (select jsonb_object_agg(status, n) from (select status, count(*) n from public.discussions group by status) x),
    'communities_30', (select count(*) from public.communities where created_at > since),
    'discussions_30', (select count(*) from public.discussions where created_at > since),
    'room_messages', (select count(*) from public.discussion_messages),
    'room_messages_30', (select count(*) from public.discussion_messages where created_at > since),
    'member_messages_30', (select count(*) from public.dm_messages where created_at > since),
    'joins_30', (select count(*) from public.community_members where joined_at > since)
              + (select count(*) from public.discussion_members where joined_at > since),
    'active_7', (select count(distinct who) from acts where at > now() - interval '7 days'),
    'active_30', (select count(distinct who) from acts where at > since),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'reports_handled_30', (select count(*) from public.reports where status <> 'open' and handled_at > since),
    'handle_hours', (select round(extract(epoch from avg(handled_at - created_at)) / 3600.0, 1) from public.reports where handled_at > since),
    'pending', (select count(*) from public.communities where status = 'pending') + (select count(*) from public.discussions where status = 'pending'),
    'daily', (select jsonb_agg(jsonb_build_object(
                'day', to_char(days.d, 'YYYY-MM-DD'),
                'messages', (select count(*) from public.discussion_messages m where m.created_at >= days.d and m.created_at < days.d + interval '1 day'),
                'joins', (select count(*) from public.community_members m where m.joined_at >= days.d and m.joined_at < days.d + interval '1 day')
                       + (select count(*) from public.discussion_members m where m.joined_at >= days.d and m.joined_at < days.d + interval '1 day'),
                'active', (select count(distinct who) from acts where acts.at >= days.d and acts.at < days.d + interval '1 day')
              ) order by days.d) from days),
    'top_communities', (select coalesce(jsonb_agg(t order by t.score desc), '[]'::jsonb) from (
        select c.name, c.slug, c.status,
               (select count(*) from public.community_members m where m.community_id = c.id and m.status = 'active') as members,
               (select count(*) from public.community_members m where m.community_id = c.id and m.joined_at > since)
               + (select count(*) from public.discussion_messages dm join public.discussions d on d.id = dm.discussion_id
                  where d.community_id = c.id and dm.created_at > since) as score
        from public.communities c where c.status in ('active', 'archived') order by score desc, c.created_at desc limit 10) t),
    'top_discussions', (select coalesce(jsonb_agg(t order by t.score desc), '[]'::jsonb) from (
        select d.title as name, d.slug, d.status, public.dr_active_count(d.id) as members,
               (select count(*) from public.discussion_messages dm where dm.discussion_id = d.id and dm.created_at > since) as score
        from public.discussions d where d.status in ('open', 'closed', 'archived') order by score desc, d.created_at desc limit 10) t)
  ) into r;
  return r;
end $$;

-- ================================================================ grants

revoke all on function public.blong_section_id(text), public.blong_on(text), public.blong_need(text), public.blong_sections(),
  public.cm_need_live(uuid), public.dr_need_live(uuid), public.blong_settings_go_live(),
  public.create_community(text, text, text, text[], text[], text, text), public.update_community(uuid, text, text, text, text[], text[], text, text),
  public.set_community_status(uuid, text), public.join_community(uuid), public.leave_community(uuid),
  public.respond_join(uuid, uuid, boolean), public.invite_to_community(uuid, uuid), public.set_community_role(uuid, uuid, text),
  public.remove_community_member(uuid, uuid), public.transfer_community(uuid, uuid),
  public.list_communities(text, text, text), public.community_page(text), public.community_people(uuid),
  public.create_discussion(text, text, text, text[], int, text, uuid), public.update_discussion(uuid, text, text, text, text[], int, text),
  public.set_discussion_status(uuid, text), public.join_discussion(uuid), public.leave_discussion(uuid),
  public.respond_discussion_join(uuid, uuid, boolean), public.invite_to_discussion(uuid, uuid), public.set_discussion_role(uuid, uuid, text),
  public.remove_discussion_member(uuid, uuid), public.transfer_discussion(uuid, uuid),
  public.post_room_message(uuid, text, uuid), public.remove_room_message(uuid), public.pin_room_message(uuid, uuid), public.discussion_page(text),
  public.member_activity(uuid, int), public.blong_feed(int),
  public.blong_admin_settings(), public.set_blong_settings(jsonb), public.blong_pending(), public.review_blong_item(text, uuid, boolean, text), public.blong_stats()
  from public;
-- Policies call these for every signed-in member.
grant execute on function public.blong_on(text), public.blong_section_id(text), public.blong_sections() to authenticated;
grant execute on function
  public.create_community(text, text, text, text[], text[], text, text), public.update_community(uuid, text, text, text, text[], text[], text, text),
  public.set_community_status(uuid, text), public.join_community(uuid), public.leave_community(uuid),
  public.respond_join(uuid, uuid, boolean), public.invite_to_community(uuid, uuid), public.set_community_role(uuid, uuid, text),
  public.remove_community_member(uuid, uuid), public.transfer_community(uuid, uuid),
  public.list_communities(text, text, text), public.community_page(text), public.community_people(uuid),
  public.create_discussion(text, text, text, text[], int, text, uuid), public.update_discussion(uuid, text, text, text, text[], int, text),
  public.set_discussion_status(uuid, text), public.join_discussion(uuid), public.leave_discussion(uuid),
  public.respond_discussion_join(uuid, uuid, boolean), public.invite_to_discussion(uuid, uuid), public.set_discussion_role(uuid, uuid, text),
  public.remove_discussion_member(uuid, uuid), public.transfer_discussion(uuid, uuid),
  public.post_room_message(uuid, text, uuid), public.remove_room_message(uuid), public.pin_room_message(uuid, uuid), public.discussion_page(text),
  public.member_activity(uuid, int), public.blong_feed(int),
  public.blong_admin_settings(), public.set_blong_settings(jsonb), public.blong_pending(), public.review_blong_item(text, uuid, boolean, text), public.blong_stats()
  to authenticated;

-- Staff with Community (manage) add people to a section's Notify me list too.
create or replace function public.admin_add_to_waitlist(p_type text, p_id uuid, p_member uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_type not in ('service', 'program', 'event', 'blong_section') or not public.has_any_perm(public.item_manage_perms(p_type)) then
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
