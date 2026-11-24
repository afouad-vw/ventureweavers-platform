-- Phase 18c (approved 2026-11-24): BLong discussions. Plan: docs/phase-18-plan.md.
-- Rooms to talk one topic through: title, description, category, tags, member limit (2-500), privacy
-- (Public, Request to join, Invite only), optionally inside a community (then only its members find it).
-- Live chat (Realtime + 10-second refresh), replies, pins, removing messages, closing a room.
-- Limits: 10 new discussions a day, 60 room messages an hour.

-- ================================================================ tables

create table public.discussions (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 90),
  title            text not null check (char_length(btrim(title)) between 3 and 120),
  description      text not null default '' check (char_length(description) <= 1000),
  category         text not null check (category in ('Fundraising', 'Building and growth', 'Investing', 'Careers and hiring', 'Programs and learning', 'Events', 'Other')),
  tags             text[] not null default '{}' check (cardinality(tags) <= 8),
  member_limit     int not null default 50 check (member_limit between 2 and 500),
  privacy          text not null default 'public' check (privacy in ('public', 'request', 'invite')),
  community_id     uuid references public.communities (id) on delete cascade,
  owner            uuid not null references public.profiles (id) on delete cascade,
  status           text not null default 'open' check (status in ('open', 'closed', 'archived')),
  archived_by_team boolean not null default false,
  pinned_message   uuid,
  last_message_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index discussions_owner_idx on public.discussions (owner, created_at);
create index discussions_community_idx on public.discussions (community_id);
create index discussions_status_idx on public.discussions (status, last_message_at desc nulls last);
create trigger discussions_touch before update on public.discussions for each row execute function public.touch_updated_at();

create table public.discussion_members (
  discussion_id uuid not null references public.discussions (id) on delete cascade,
  member_id     uuid not null references public.profiles (id) on delete cascade,
  role          text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status        text not null default 'active' check (status in ('active', 'requested', 'invited')),
  invited_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  joined_at     timestamptz,
  primary key (discussion_id, member_id)
);
create index discussion_members_member_idx on public.discussion_members (member_id, status);
create unique index discussion_one_owner on public.discussion_members (discussion_id) where role = 'owner';

create table public.discussion_messages (
  id            uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions (id) on delete cascade,
  author        uuid not null references public.profiles (id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 2000),
  reply_to      uuid references public.discussion_messages (id) on delete set null,
  created_at    timestamptz not null default clock_timestamp(),
  removed_at    timestamptz,
  removed_by    uuid
);
create index discussion_messages_room_idx on public.discussion_messages (discussion_id, created_at);
create index discussion_messages_author_idx on public.discussion_messages (author, created_at);
alter table public.discussions add constraint discussions_pinned_fk foreign key (pinned_message) references public.discussion_messages (id) on delete set null;

-- ================================================================ helpers

create or replace function public.dr_role(p_room uuid, p_member uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.discussion_members where discussion_id = p_room and member_id = p_member and status = 'active';
$$;

create or replace function public.dr_is_admin(p_room uuid, p_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.dr_role(p_room, p_member) in ('owner', 'admin'), false);
$$;

-- Whether a member can find a room (admin accounts and suspended members can't): not archived (unless they run it), the community's members only for
-- rooms inside a community, and Invite-only rooms only for people in them or invited.
create or replace function public.dr_can_find(p_room uuid, p_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.discussions d
    where d.id = p_room
      and public.blong_member(p_member)
      and (d.status <> 'archived' or public.dr_is_admin(d.id, p_member))
      and (d.community_id is null or public.cm_role(d.community_id, p_member) is not null or public.dr_role(d.id, p_member) is not null)
      and (d.privacy <> 'invite' or exists (select 1 from public.discussion_members m where m.discussion_id = d.id and m.member_id = p_member))
      and not public.blong_blocked(p_member, d.owner));
$$;

-- Whether a member can read a room's messages: active members always; anyone who finds a Public room.
create or replace function public.dr_can_read(p_room uuid, p_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.dr_role(p_room, p_member) is not null
      or (public.dr_can_find(p_room, p_member) and (select privacy from public.discussions where id = p_room) = 'public');
$$;

create or replace function public.dr_notify_admins(p_room uuid, p_text text, p_href text) returns void
language sql security definer set search_path = '' as $$
  select public.notify(member_id, p_text, p_href) from public.discussion_members
  where discussion_id = p_room and status = 'active' and role in ('owner', 'admin');
$$;

create or replace function public.dr_active_count(p_room uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.discussion_members where discussion_id = p_room and status = 'active';
$$;

-- ================================================================ row level security

alter table public.discussions enable row level security;
alter table public.discussion_members enable row level security;
alter table public.discussion_messages enable row level security;

create policy "Members find rooms they may see; Community staff see all" on public.discussions
  for select to authenticated using (public.dr_can_find(id, auth.uid()) or public.has_any_perm('{community.view}'::text[]));

create policy "Room members are visible to people who can read the room" on public.discussion_members
  for select to authenticated using (
    member_id = auth.uid()
    or public.dr_is_admin(discussion_id, auth.uid())
    or public.has_any_perm('{community.view}'::text[])
    or (status = 'active' and public.dr_can_read(discussion_id, auth.uid())));

-- Staff read room messages only through reports (the reported message is copied into the report).
create policy "Room messages are readable by people who can read the room" on public.discussion_messages
  for select to authenticated using (public.dr_can_read(discussion_id, auth.uid()));

grant select on public.discussions, public.discussion_members, public.discussion_messages to authenticated;
grant all on public.discussions, public.discussion_members, public.discussion_messages to service_role;

-- ================================================================ create, edit, status

create or replace function public.create_discussion(
  p_title text, p_description text, p_category text, p_tags text[], p_limit int, p_privacy text, p_community uuid default null
) returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  s text;
  rid uuid;
begin
  if (select count(*) from public.discussions where owner = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too_many_discussions' using errcode = '22023';
  end if;
  if p_community is not null and (public.cm_role(p_community, me) is null
     or not exists (select 1 from public.communities where id = p_community and status = 'active')) then
    raise exception 'not_in_community' using errcode = '42501';
  end if;
  s := public.blong_slug(p_title);
  insert into public.discussions (slug, title, description, category, tags, member_limit, privacy, community_id, owner)
    values (s, btrim(p_title), btrim(coalesce(p_description, '')), p_category, public.blong_topics(p_tags), coalesce(p_limit, 50),
            coalesce(p_privacy, 'public'), p_community, me)
    returning id into rid;
  insert into public.discussion_members (discussion_id, member_id, role, status, joined_at) values (rid, me, 'owner', 'active', now());
  return s;
end $$;

create or replace function public.update_discussion(
  p_id uuid, p_title text, p_description text, p_category text, p_tags text[], p_limit int, p_privacy text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
begin
  if not public.dr_is_admin(p_id, me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_limit < public.dr_active_count(p_id) then raise exception 'limit_below_members' using errcode = '22023'; end if;
  update public.discussions set title = btrim(p_title), description = btrim(coalesce(p_description, '')), category = p_category,
    tags = public.blong_topics(p_tags), member_limit = p_limit, privacy = p_privacy
  where id = p_id;
end $$;

-- Owners and admins close (read-only) or reopen a room; owners archive or restore; Community staff archive any.
create or replace function public.set_discussion_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  staff boolean := public.has_any_perm('{community.manage}'::text[]);
  d public.discussions;
  me uuid;
begin
  if p_status not in ('open', 'closed', 'archived') then raise exception 'bad_status' using errcode = '22023'; end if;
  select * into d from public.discussions where id = p_id;
  if d.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not staff then
    me := public.blong_guard();
    if not public.dr_is_admin(p_id, me) then raise exception 'not_allowed' using errcode = '42501'; end if;
    if (p_status = 'archived' or d.status = 'archived') and d.owner <> me then raise exception 'not_allowed' using errcode = '42501'; end if;
    if d.archived_by_team then raise exception 'archived_by_team' using errcode = '42501'; end if;
  end if;
  update public.discussions set status = p_status, archived_by_team = (staff and p_status = 'archived') where id = p_id;
  if staff and p_status = 'archived' then
    perform public.notify(d.owner, 'The VentureWeavers team archived your discussion ' || d.title || '.', '/blong/discussions/' || d.slug);
  end if;
end $$;

create or replace function public.delete_discussion(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.blong_guard();
begin
  delete from public.discussions where id = p_id and owner = me;
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
end $$;

-- ================================================================ joining and leaving

-- Public: join while there's room. Request to join: a request. Invite only: accept a waiting invite.
create or replace function public.join_discussion(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  d public.discussions;
  cur text;
  who text;
begin
  select * into d from public.discussions where id = p_id and status = 'open';
  if d.id is null or not public.dr_can_find(p_id, me) then raise exception 'not_found' using errcode = 'P0002'; end if;
  select status into cur from public.discussion_members where discussion_id = p_id and member_id = me;
  if cur in ('active', 'requested') then return cur; end if;
  if cur = 'invited' or d.privacy = 'public' then
    perform 1 from public.discussions where id = p_id for update;
    if public.dr_active_count(p_id) >= d.member_limit then raise exception 'room_full' using errcode = '22023'; end if;
    insert into public.discussion_members (discussion_id, member_id, role, status, joined_at) values (p_id, me, 'member', 'active', now())
      on conflict (discussion_id, member_id) do update set status = 'active', joined_at = now();
    return 'active';
  end if;
  if d.privacy = 'invite' then raise exception 'invite_only' using errcode = '42501'; end if;
  insert into public.discussion_members (discussion_id, member_id, role, status) values (p_id, me, 'member', 'requested');
  select coalesce(nullif(btrim(full_name), ''), 'A member') into who from public.profiles where id = me;
  perform public.dr_notify_admins(p_id, who || ' asked to join the discussion ' || d.title || '.', '/blong/discussions/' || d.slug || '?tab=members');
  return 'requested';
end $$;

create or replace function public.leave_discussion(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.blong_guard();
begin
  if public.dr_role(p_id, me) = 'owner' then raise exception 'owner_must_transfer' using errcode = '22023'; end if;
  delete from public.discussion_members where discussion_id = p_id and member_id = me;
end $$;

create or replace function public.respond_discussion_join(p_id uuid, p_member uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  d public.discussions;
begin
  if not public.dr_is_admin(p_id, me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into d from public.discussions where id = p_id for update;
  if p_accept then
    if public.dr_active_count(p_id) >= d.member_limit then raise exception 'room_full' using errcode = '22023'; end if;
    update public.discussion_members set status = 'active', joined_at = now() where discussion_id = p_id and member_id = p_member and status = 'requested';
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    perform public.notify(p_member, 'You''re in: the discussion ' || d.title || ' accepted your request.', '/blong/discussions/' || d.slug);
  else
    delete from public.discussion_members where discussion_id = p_id and member_id = p_member and status = 'requested';
  end if;
end $$;

create or replace function public.invite_to_discussion(p_id uuid, p_member uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  d public.discussions;
  cur text;
  who text;
begin
  if not public.dr_is_admin(p_id, me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_member = me or not public.blong_member(p_member) or public.blong_blocked(me, p_member) then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into d from public.discussions where id = p_id and status = 'open';
  if d.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if d.community_id is not null and public.cm_role(d.community_id, p_member) is null then raise exception 'not_in_community' using errcode = '42501'; end if;
  select status into cur from public.discussion_members where discussion_id = p_id and member_id = p_member;
  if cur in ('active', 'invited') then return cur; end if;
  if (select count(*) from public.discussion_members where invited_by = me and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too_many_invites' using errcode = '22023';
  end if;
  if cur = 'requested' then
    if public.dr_active_count(p_id) >= d.member_limit then raise exception 'room_full' using errcode = '22023'; end if;
    update public.discussion_members set status = 'active', joined_at = now() where discussion_id = p_id and member_id = p_member;
    perform public.notify(p_member, 'You''re in: the discussion ' || d.title || ' accepted your request.', '/blong/discussions/' || d.slug);
    return 'active';
  end if;
  insert into public.discussion_members (discussion_id, member_id, role, status, invited_by) values (p_id, p_member, 'member', 'invited', me);
  select coalesce(nullif(btrim(full_name), ''), 'A member') into who from public.profiles where id = me;
  perform public.notify(p_member, who || ' invited you to the discussion ' || d.title || '.', '/blong/discussions/' || d.slug);
  return 'invited';
end $$;

-- ================================================================ roles

create or replace function public.set_discussion_role(p_id uuid, p_member uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  d public.discussions;
begin
  if p_role not in ('admin', 'member') then raise exception 'bad_role' using errcode = '22023'; end if;
  if not public.dr_is_admin(p_id, me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.discussion_members set role = p_role
    where discussion_id = p_id and member_id = p_member and status = 'active' and role <> 'owner';
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_role = 'admin' then
    select * into d from public.discussions where id = p_id;
    perform public.notify(p_member, 'You''re now an admin of the discussion ' || d.title || '.', '/blong/discussions/' || d.slug);
  end if;
end $$;

create or replace function public.remove_discussion_member(p_id uuid, p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  mine text := public.dr_role(p_id, me);
  theirs text;
begin
  select role into theirs from public.discussion_members where discussion_id = p_id and member_id = p_member;
  if theirs is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if theirs = 'owner' or mine is null or mine = 'member' or (mine = 'admin' and theirs = 'admin') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  delete from public.discussion_members where discussion_id = p_id and member_id = p_member;
end $$;

create or replace function public.transfer_discussion(p_id uuid, p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  d public.discussions;
begin
  if coalesce(public.dr_role(p_id, me), '') <> 'owner' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_member = me or public.dr_role(p_id, p_member) is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.discussion_members set role = 'admin' where discussion_id = p_id and member_id = me;
  update public.discussion_members set role = 'owner' where discussion_id = p_id and member_id = p_member;
  update public.discussions set owner = p_member where id = p_id returning * into d;
  perform public.notify(p_member, 'You''re now the owner of the discussion ' || d.title || '.', '/blong/discussions/' || d.slug);
end $$;

-- ================================================================ messages

-- Active members post while the room is open. A reply tells the person replied to.
create or replace function public.post_room_message(p_id uuid, p_body text, p_reply_to uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  body text := btrim(coalesce(p_body, ''));
  d public.discussions;
  to_whom uuid;
  mid uuid;
  who text;
begin
  if char_length(body) not between 1 and 2000 then raise exception 'bad_message' using errcode = '22023'; end if;
  select * into d from public.discussions where id = p_id;
  if d.id is null or public.dr_role(p_id, me) is null then raise exception 'not_a_room_member' using errcode = '42501'; end if;
  if d.status <> 'open' then raise exception 'room_closed' using errcode = '22023'; end if;
  if (select count(*) from public.discussion_messages where author = me and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'too_many_messages' using errcode = '22023';
  end if;
  if p_reply_to is not null then
    select author into to_whom from public.discussion_messages where id = p_reply_to and discussion_id = p_id and removed_at is null;
    if to_whom is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  end if;
  insert into public.discussion_messages (discussion_id, author, body, reply_to) values (p_id, me, body, p_reply_to) returning id into mid;
  update public.discussions set last_message_at = clock_timestamp() where id = p_id;
  if to_whom is not null and to_whom <> me and public.dr_role(p_id, to_whom) is not null and not public.blong_blocked(me, to_whom) then
    select coalesce(nullif(btrim(full_name), ''), 'A member') into who from public.profiles where id = me;
    perform public.notify(to_whom, who || ' replied to you in ' || d.title || ': ' || left(body, 80), '/blong/discussions/' || d.slug);
  end if;
  return mid;
end $$;

-- Authors remove their own messages; owners and admins remove any. The text is cleared.
create or replace function public.remove_room_message(p_message uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  m public.discussion_messages;
begin
  select * into m from public.discussion_messages where id = p_message and removed_at is null;
  if m.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if m.author <> me and not public.dr_is_admin(m.discussion_id, me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.discussion_messages set body = '[removed]', removed_at = now(), removed_by = me where id = p_message;
  update public.discussions set pinned_message = null where id = m.discussion_id and pinned_message = p_message;
end $$;

create or replace function public.pin_room_message(p_id uuid, p_message uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.blong_guard();
begin
  if not public.dr_is_admin(p_id, me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_message is not null and not exists (select 1 from public.discussion_messages where id = p_message and discussion_id = p_id and removed_at is null) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.discussions set pinned_message = p_message where id = p_id;
end $$;

-- ================================================================ reading

create or replace function public.list_discussions(p_scope text default 'explore', p_q text default null, p_category text default null, p_community uuid default null)
returns table (id uuid, slug text, title text, description text, category text, tags text[], member_limit int, privacy text,
               community_id uuid, community_name text, community_slug text, status text, members int, last_message_at timestamptz,
               my_role text, my_status text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.id, d.slug, d.title, d.description, d.category, d.tags, d.member_limit, d.privacy,
         d.community_id, c.name, c.slug, d.status, public.dr_active_count(d.id), d.last_message_at,
         mm.role, mm.status, d.created_at
  from public.discussions d
  left join public.communities c on c.id = d.community_id
  left join public.discussion_members mm on mm.discussion_id = d.id and mm.member_id = auth.uid()
  where auth.uid() is not null
    and public.dr_can_find(d.id, auth.uid())
    and (p_scope <> 'explore' or d.status = 'open')
    and case p_scope
          when 'joined' then mm.status in ('active', 'invited', 'requested')
          when 'owned' then mm.status = 'active' and mm.role in ('owner', 'admin')
          else true end
    and (p_community is null or d.community_id = p_community)
    and (p_category is null or d.category = p_category)
    and (coalesce(btrim(p_q), '') = '' or d.title ilike '%' || btrim(p_q) || '%' or d.description ilike '%' || btrim(p_q) || '%'
         or exists (select 1 from unnest(d.tags) t where t ilike '%' || btrim(p_q) || '%'))
  order by (mm.status = 'invited') desc nulls last, coalesce(d.last_message_at, d.created_at) desc
  limit 200;
$$;

create or replace function public.discussion_page(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  d public.discussions;
  mm public.discussion_members;
  staff boolean := public.has_any_perm('{community.view}'::text[]);
begin
  if me is null then return null; end if;
  select * into d from public.discussions where slug = p_slug;
  if d.id is null then return null; end if;
  if not public.dr_can_find(d.id, me) and not staff then return null; end if;
  select * into mm from public.discussion_members where discussion_id = d.id and member_id = me;
  return jsonb_build_object(
    'id', d.id, 'slug', d.slug, 'title', d.title, 'description', d.description, 'category', d.category, 'tags', to_jsonb(d.tags),
    'member_limit', d.member_limit, 'privacy', d.privacy, 'status', d.status, 'archived_by_team', d.archived_by_team, 'created_at', d.created_at,
    'community', (select jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug) from public.communities c where c.id = d.community_id),
    'members', public.dr_active_count(d.id),
    'requests', case when mm.status = 'active' and mm.role in ('owner', 'admin')
                     then (select count(*) from public.discussion_members m where m.discussion_id = d.id and m.status = 'requested') else 0 end,
    'owner', (select jsonb_build_object('id', p.id, 'name', coalesce(nullif(btrim(p.full_name), ''), 'Member'), 'avatar_url', p.avatar_url)
              from public.profiles p where p.id = d.owner),
    'pinned', (select jsonb_build_object('id', m.id, 'body', m.body, 'name', coalesce(nullif(btrim(p.full_name), ''), 'Member'))
               from public.discussion_messages m join public.profiles p on p.id = m.author
               where m.id = d.pinned_message and m.removed_at is null and public.dr_can_read(d.id, me)),
    'my_role', mm.role, 'my_status', mm.status,
    'can_read', public.dr_can_read(d.id, me)
  );
end $$;

create or replace function public.discussion_people(p_id uuid)
returns table (id uuid, name text, avatar_url text, roles text[], role text, status text, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(nullif(btrim(p.full_name), ''), 'Member'), p.avatar_url, p.roles, m.role, m.status, coalesce(m.joined_at, m.created_at)
  from public.discussion_members m
  join public.profiles p on p.id = m.member_id
  where m.discussion_id = p_id and auth.uid() is not null
    and ((m.status = 'active' and public.dr_can_read(p_id, auth.uid())) or public.dr_is_admin(p_id, auth.uid()) or m.member_id = auth.uid())
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.status, coalesce(m.joined_at, m.created_at)
  limit 600;
$$;

-- The latest 200 messages in a room (or those after a time), with authors and the message replied to.
create or replace function public.room_messages(p_id uuid, p_after timestamptz default null)
returns table (id uuid, author uuid, name text, avatar_url text, body text, removed boolean, reply_to uuid, reply_name text, reply_body text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from (
    select m.id, m.author, coalesce(nullif(btrim(p.full_name), ''), 'Member'), p.avatar_url,
           case when m.removed_at is null then m.body else '' end, m.removed_at is not null,
           m.reply_to, coalesce(nullif(btrim(rp.full_name), ''), 'Member'),
           case when r.removed_at is null then left(r.body, 140) else '' end, m.created_at
    from public.discussion_messages m
    join public.profiles p on p.id = m.author
    left join public.discussion_messages r on r.id = m.reply_to
    left join public.profiles rp on rp.id = r.author
    where m.discussion_id = p_id and public.dr_can_read(p_id, auth.uid())
      and (p_after is null or m.created_at > p_after)
      and not exists (select 1 from public.blocks b where b.blocker = auth.uid() and b.blocked = m.author)
    order by m.created_at desc
    limit 200
  ) x order by created_at;
$$;

-- ================================================================ reports on rooms and room messages

create or replace function public.report_content(p_kind text, p_target uuid, p_reason text, p_details text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  who uuid;
  ex text;
  rid uuid;
begin
  if p_reason not in ('spam', 'harassment', 'inappropriate', 'impersonation', 'privacy', 'other') then raise exception 'bad_reason' using errcode = '22023'; end if;
  if char_length(coalesce(p_details, '')) > 1000 then raise exception 'bad_details' using errcode = '22023'; end if;
  if (select count(*) from public.reports where reporter = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too_many_reports' using errcode = '22023';
  end if;
  if p_kind = 'member' then
    if not exists (select 1 from public.profiles where id = p_target) or p_target = me then raise exception 'not_found' using errcode = 'P0002'; end if;
    who := p_target;
  elsif p_kind = 'message' then
    select m.author, m.body into who, ex from public.dm_messages m join public.dm_threads t on t.id = m.thread_id
      where m.id = p_target and me in (t.a, t.b) and m.author <> me;
    if who is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  elsif p_kind = 'community' then
    select owner, name || E'\n\n' || description into who, ex from public.communities where id = p_target and status = 'active';
    if who is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  elsif p_kind = 'discussion' then
    select owner, title || E'\n\n' || description into who, ex from public.discussions where id = p_target and public.dr_can_find(id, me);
    if who is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  elsif p_kind = 'room_message' then
    select m.author, m.body into who, ex from public.discussion_messages m
      where m.id = p_target and m.removed_at is null and m.author <> me and public.dr_can_read(m.discussion_id, me);
    if who is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  else
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  insert into public.reports (reporter, kind, target_id, target_member, reason, details, excerpt)
    values (me, p_kind, p_target, who, p_reason, nullif(btrim(coalesce(p_details, '')), ''), left(ex, 2000))
    returning id into rid;
  return rid;
end $$;

-- ================================================================ grants

revoke all on function public.dr_role(uuid, uuid), public.dr_is_admin(uuid, uuid), public.dr_can_find(uuid, uuid), public.dr_can_read(uuid, uuid),
  public.dr_notify_admins(uuid, text, text), public.dr_active_count(uuid),
  public.create_discussion(text, text, text, text[], int, text, uuid), public.update_discussion(uuid, text, text, text, text[], int, text),
  public.set_discussion_status(uuid, text), public.delete_discussion(uuid), public.join_discussion(uuid), public.leave_discussion(uuid),
  public.respond_discussion_join(uuid, uuid, boolean), public.invite_to_discussion(uuid, uuid), public.set_discussion_role(uuid, uuid, text),
  public.remove_discussion_member(uuid, uuid), public.transfer_discussion(uuid, uuid),
  public.post_room_message(uuid, text, uuid), public.remove_room_message(uuid), public.pin_room_message(uuid, uuid),
  public.list_discussions(text, text, text, uuid), public.discussion_page(text), public.discussion_people(uuid), public.room_messages(uuid, timestamptz),
  public.report_content(text, uuid, text, text)
  from public;
-- The policies above call these for every signed-in member.
grant execute on function public.dr_role(uuid, uuid), public.dr_is_admin(uuid, uuid), public.dr_can_find(uuid, uuid), public.dr_can_read(uuid, uuid)
  to authenticated;
grant execute on function
  public.create_discussion(text, text, text, text[], int, text, uuid), public.update_discussion(uuid, text, text, text, text[], int, text),
  public.set_discussion_status(uuid, text), public.delete_discussion(uuid), public.join_discussion(uuid), public.leave_discussion(uuid),
  public.respond_discussion_join(uuid, uuid, boolean), public.invite_to_discussion(uuid, uuid), public.set_discussion_role(uuid, uuid, text),
  public.remove_discussion_member(uuid, uuid), public.transfer_discussion(uuid, uuid),
  public.post_room_message(uuid, text, uuid), public.remove_room_message(uuid), public.pin_room_message(uuid, uuid),
  public.list_discussions(text, text, text, uuid), public.discussion_page(text), public.discussion_people(uuid), public.room_messages(uuid, timestamptz),
  public.report_content(text, uuid, text, text)
  to authenticated;

-- Live updates for rooms (Supabase Realtime respects the policies above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.discussion_messages;
  end if;
end $$;
