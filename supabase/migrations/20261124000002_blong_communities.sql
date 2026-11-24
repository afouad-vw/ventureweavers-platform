-- Phase 18b (approved 2026-11-24): BLong communities. Plan: docs/phase-18-plan.md.
-- Any member creates a community (3 a day): name, description, type, topics, audience, Public or Private, cover.
-- Public communities join at once; Private ones take a request an admin accepts, or an invite.
-- Roles: owner, admin, member. Every signed-in member can find any active community (name, description,
-- count); only active members see a Private community's members. Writes go through the functions below.

-- ================================================================ tables

create table public.communities (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 90),
  name        text not null check (char_length(btrim(name)) between 3 and 80),
  description text not null check (char_length(btrim(description)) between 1 and 1000),
  type        text not null check (type in ('Interest', 'Industry or sector', 'Role', 'Location', 'Program alumni', 'Other')),
  topics      text[] not null default '{}' check (cardinality(topics) <= 8),
  audience    text[] not null default '{}' check (audience <@ public.role_list()),
  visibility  text not null default 'public' check (visibility in ('public', 'private')),
  cover_url   text check (cover_url is null or (char_length(cover_url) <= 300 and cover_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/content-images/communities/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$')),
  owner       uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'active' check (status in ('active', 'archived')),
  archived_by_team boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index communities_owner_idx on public.communities (owner, created_at);
create index communities_status_idx on public.communities (status, created_at desc);
create trigger communities_touch before update on public.communities for each row execute function public.touch_updated_at();

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  member_id    uuid not null references public.profiles (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status       text not null default 'active' check (status in ('active', 'requested', 'invited')),
  invited_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  joined_at    timestamptz,
  primary key (community_id, member_id)
);
create index community_members_member_idx on public.community_members (member_id, status);
create unique index community_one_owner on public.community_members (community_id) where role = 'owner';

-- ================================================================ helpers

-- The viewer's active role in a community, or null.
create or replace function public.cm_role(p_community uuid, p_member uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.community_members where community_id = p_community and member_id = p_member and status = 'active';
$$;

create or replace function public.cm_is_admin(p_community uuid, p_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.cm_role(p_community, p_member) in ('owner', 'admin'), false);
$$;

-- Owners and admins of a community, for notifications.
create or replace function public.cm_notify_admins(p_community uuid, p_text text, p_href text) returns void
language sql security definer set search_path = '' as $$
  select public.notify(member_id, p_text, p_href) from public.community_members
  where community_id = p_community and status = 'active' and role in ('owner', 'admin');
$$;

create or replace function public.blong_slug(p_name text) returns text
language plpgsql volatile set search_path = '' as $$
declare base text := trim(both '-' from regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g'));
begin
  if base = '' then base := 'community'; end if;
  return left(base, 60) || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
end $$;

-- Topics: trimmed, 1-30 characters, no duplicates, up to 8.
create or replace function public.blong_topics(p text[]) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(t order by first), '{}') from (
    select btrim(x) as t, min(ord) as first from unnest(coalesce(p, '{}')) with ordinality u(x, ord)
    where char_length(btrim(x)) between 1 and 30 group by btrim(x)
  ) s;
$$;

-- ================================================================ row level security

alter table public.communities enable row level security;
alter table public.community_members enable row level security;

create policy "Members find active communities; owners and Community staff see archived ones" on public.communities
  for select to authenticated using (
    status = 'active' or owner = auth.uid() or public.cm_is_admin(id, auth.uid()) or public.has_any_perm('{community.view}'::text[]));

-- Active members of Public communities are visible to everyone; of Private ones, only to their members.
-- Requests and invites are visible to the person and to the community's owners and admins.
create policy "Community members are visible as the community allows" on public.community_members
  for select to authenticated using (
    member_id = auth.uid()
    or public.cm_is_admin(community_id, auth.uid())
    or public.has_any_perm('{community.view}'::text[])
    or (status = 'active' and (
      public.cm_role(community_id, auth.uid()) is not null
      or exists (select 1 from public.communities c where c.id = community_id and c.visibility = 'public' and c.status = 'active'))));

grant select on public.communities, public.community_members to authenticated;
grant all on public.communities, public.community_members to service_role;

-- ================================================================ create, edit, archive, delete

create or replace function public.create_community(
  p_name text, p_description text, p_type text, p_topics text[], p_audience text[], p_visibility text, p_cover text default null
) returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  s text;
  cid uuid;
begin
  if (select count(*) from public.communities where owner = me and created_at > now() - interval '1 day') >= 3 then
    raise exception 'too_many_communities' using errcode = '22023';
  end if;
  if p_cover is not null and p_cover !~ ('/content-images/communities/' || me::text || '/') then raise exception 'bad_cover' using errcode = '22023'; end if;
  s := public.blong_slug(p_name);
  insert into public.communities (slug, name, description, type, topics, audience, visibility, cover_url, owner)
    values (s, btrim(p_name), btrim(p_description), p_type, public.blong_topics(p_topics), coalesce(p_audience, '{}'),
            coalesce(p_visibility, 'public'), p_cover, me)
    returning id into cid;
  insert into public.community_members (community_id, member_id, role, status, joined_at) values (cid, me, 'owner', 'active', now());
  return s;
end $$;

create or replace function public.update_community(
  p_id uuid, p_name text, p_description text, p_type text, p_topics text[], p_audience text[], p_visibility text, p_cover text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  was text;
begin
  if not public.cm_is_admin(p_id, me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_cover is not null and p_cover <> coalesce((select cover_url from public.communities where id = p_id), '')
     and p_cover !~ ('/content-images/communities/' || me::text || '/') then raise exception 'bad_cover' using errcode = '22023'; end if;
  select visibility into was from public.communities where id = p_id;
  update public.communities set name = btrim(p_name), description = btrim(p_description), type = p_type,
    topics = public.blong_topics(p_topics), audience = coalesce(p_audience, '{}'), visibility = coalesce(p_visibility, visibility), cover_url = p_cover
  where id = p_id;
  -- Turning Public accepts every waiting request.
  if was = 'private' and p_visibility = 'public' then
    update public.community_members set status = 'active', joined_at = now() where community_id = p_id and status = 'requested';
  end if;
end $$;

-- Owners archive or restore their community; Community staff can archive any (only staff then restore it).
create or replace function public.set_community_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  staff boolean := public.has_any_perm('{community.manage}'::text[]);
  c public.communities;
begin
  if p_status not in ('active', 'archived') then raise exception 'bad_status' using errcode = '22023'; end if;
  select * into c from public.communities where id = p_id;
  if c.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not staff then
    if c.owner <> public.blong_guard() then raise exception 'not_allowed' using errcode = '42501'; end if;
    if c.archived_by_team then raise exception 'archived_by_team' using errcode = '42501'; end if;
  end if;
  update public.communities set status = p_status, archived_by_team = (staff and p_status = 'archived') where id = p_id;
  if staff and p_status = 'archived' then
    perform public.notify(c.owner, 'The VentureWeavers team archived your community ' || c.name || '.', '/blong/communities/' || c.slug);
  end if;
end $$;

create or replace function public.delete_community(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.blong_guard();
begin
  delete from public.communities where id = p_id and owner = me;
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
end $$;

-- ================================================================ joining and leaving

-- Public: join at once. Private: a request (or accept a waiting invite). Returns the member's status.
create or replace function public.join_community(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  c public.communities;
  cur text;
  who text;
begin
  select * into c from public.communities where id = p_id and status = 'active';
  if c.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.blong_blocked(me, c.owner) then raise exception 'not_found' using errcode = 'P0002'; end if;
  select status into cur from public.community_members where community_id = p_id and member_id = me;
  if cur = 'active' or cur = 'requested' then return cur; end if;
  if cur = 'invited' or c.visibility = 'public' then
    insert into public.community_members (community_id, member_id, role, status, joined_at) values (p_id, me, 'member', 'active', now())
      on conflict (community_id, member_id) do update set status = 'active', joined_at = now();
    return 'active';
  end if;
  insert into public.community_members (community_id, member_id, role, status) values (p_id, me, 'member', 'requested');
  select coalesce(nullif(btrim(full_name), ''), 'A member') into who from public.profiles where id = me;
  perform public.cm_notify_admins(p_id, who || ' asked to join ' || c.name || '.', '/blong/communities/' || c.slug || '?tab=members');
  return 'requested';
end $$;

-- Leave, take back a request, or decline an invite. Owners hand ownership to someone first.
create or replace function public.leave_community(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.blong_guard();
begin
  if public.cm_role(p_id, me) = 'owner' then raise exception 'owner_must_transfer' using errcode = '22023'; end if;
  delete from public.community_members where community_id = p_id and member_id = me;
end $$;

create or replace function public.respond_join(p_id uuid, p_member uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  c public.communities;
begin
  if not public.cm_is_admin(p_id, me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into c from public.communities where id = p_id;
  if p_accept then
    update public.community_members set status = 'active', joined_at = now() where community_id = p_id and member_id = p_member and status = 'requested';
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    perform public.notify(p_member, 'You''re in: ' || c.name || ' accepted your request.', '/blong/communities/' || c.slug);
  else
    delete from public.community_members where community_id = p_id and member_id = p_member and status = 'requested';
  end if;
end $$;

create or replace function public.invite_to_community(p_id uuid, p_member uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  c public.communities;
  cur text;
  who text;
begin
  if not public.cm_is_admin(p_id, me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_member = me or not public.blong_member(p_member) or public.blong_blocked(me, p_member) then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into c from public.communities where id = p_id and status = 'active';
  if c.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  select status into cur from public.community_members where community_id = p_id and member_id = p_member;
  if cur = 'active' or cur = 'invited' then return cur; end if;
  if cur = 'requested' then
    update public.community_members set status = 'active', joined_at = now() where community_id = p_id and member_id = p_member;
    perform public.notify(p_member, 'You''re in: ' || c.name || ' accepted your request.', '/blong/communities/' || c.slug);
    return 'active';
  end if;
  if (select count(*) from public.community_members where invited_by = me and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too_many_invites' using errcode = '22023';
  end if;
  insert into public.community_members (community_id, member_id, role, status, invited_by) values (p_id, p_member, 'member', 'invited', me);
  select coalesce(nullif(btrim(full_name), ''), 'A member') into who from public.profiles where id = me;
  perform public.notify(p_member, who || ' invited you to join ' || c.name || '.', '/blong/communities/' || c.slug);
  return 'invited';
end $$;

-- ================================================================ roles

-- Owners and admins make members admins or members again; they can't change the owner.
create or replace function public.set_community_role(p_id uuid, p_member uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  c public.communities;
begin
  if p_role not in ('admin', 'member') then raise exception 'bad_role' using errcode = '22023'; end if;
  if not public.cm_is_admin(p_id, me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.community_members set role = p_role
    where community_id = p_id and member_id = p_member and status = 'active' and role <> 'owner';
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_role = 'admin' then
    select * into c from public.communities where id = p_id;
    perform public.notify(p_member, 'You''re now an admin of ' || c.name || '.', '/blong/communities/' || c.slug || '?tab=members');
  end if;
end $$;

-- Owners remove anyone but themselves; admins remove members (not other admins).
create or replace function public.remove_community_member(p_id uuid, p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  mine text := public.cm_role(p_id, me);
  theirs text;
begin
  select role into theirs from public.community_members where community_id = p_id and member_id = p_member;
  if theirs is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if theirs = 'owner' or mine is null or mine = 'member' or (mine = 'admin' and theirs = 'admin') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  delete from public.community_members where community_id = p_id and member_id = p_member;
end $$;

create or replace function public.transfer_community(p_id uuid, p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  c public.communities;
begin
  if public.cm_role(p_id, me) <> 'owner' or public.cm_role(p_id, me) is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_member = me or public.cm_role(p_id, p_member) is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.community_members set role = 'admin' where community_id = p_id and member_id = me;
  update public.community_members set role = 'owner' where community_id = p_id and member_id = p_member;
  update public.communities set owner = p_member where id = p_id returning * into c;
  perform public.notify(p_member, 'You''re now the owner of ' || c.name || '.', '/blong/communities/' || c.slug);
end $$;

-- ================================================================ reading

-- Communities with their member count and the viewer's place in each. p_scope: explore, joined, owned.
create or replace function public.list_communities(p_scope text default 'explore', p_q text default null, p_type text default null)
returns table (id uuid, slug text, name text, description text, type text, topics text[], audience text[], visibility text,
               cover_url text, status text, members int, my_role text, my_status text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.slug, c.name, c.description, c.type, c.topics, c.audience, c.visibility, c.cover_url, c.status,
         (select count(*)::int from public.community_members m where m.community_id = c.id and m.status = 'active'),
         mm.role, mm.status, c.created_at
  from public.communities c
  left join public.community_members mm on mm.community_id = c.id and mm.member_id = auth.uid()
  where auth.uid() is not null
    and (c.status = 'active' or (p_scope <> 'explore' and c.owner = auth.uid()))
    and not public.blong_blocked(auth.uid(), c.owner)
    and case p_scope
          when 'joined' then mm.status in ('active', 'invited', 'requested')
          when 'owned' then mm.status = 'active' and mm.role in ('owner', 'admin')
          else true end
    and (p_type is null or c.type = p_type)
    and (coalesce(btrim(p_q), '') = '' or c.name ilike '%' || btrim(p_q) || '%' or c.description ilike '%' || btrim(p_q) || '%'
         or exists (select 1 from unnest(c.topics) t where t ilike '%' || btrim(p_q) || '%'))
  order by (mm.status = 'invited') desc nulls last, (select count(*) from public.community_members m where m.community_id = c.id and m.status = 'active') desc, c.created_at desc
  limit 200;
$$;

-- One community for its page, with the viewer's place in it.
create or replace function public.community_page(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  c public.communities;
  mm public.community_members;
  staff boolean := public.has_any_perm('{community.view}'::text[]);
begin
  if me is null then return null; end if;
  select * into c from public.communities where slug = p_slug;
  if c.id is null then return null; end if;
  select * into mm from public.community_members where community_id = c.id and member_id = me;
  if c.status <> 'active' and not (mm.status = 'active' and mm.role in ('owner', 'admin')) and not staff then return null; end if;
  if public.blong_blocked(me, c.owner) and not staff then return null; end if;
  return jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'name', c.name, 'description', c.description, 'type', c.type, 'topics', to_jsonb(c.topics),
    'audience', to_jsonb(c.audience), 'visibility', c.visibility, 'cover_url', c.cover_url, 'status', c.status,
    'archived_by_team', c.archived_by_team, 'created_at', c.created_at,
    'members', (select count(*) from public.community_members m where m.community_id = c.id and m.status = 'active'),
    'requests', case when mm.status = 'active' and mm.role in ('owner', 'admin')
                     then (select count(*) from public.community_members m where m.community_id = c.id and m.status = 'requested') else 0 end,
    'owner', (select jsonb_build_object('id', p.id, 'name', coalesce(nullif(btrim(p.full_name), ''), 'Member'), 'avatar_url', p.avatar_url)
              from public.profiles p where p.id = c.owner),
    'my_role', mm.role, 'my_status', mm.status,
    'can_see_inside', c.visibility = 'public' or mm.status = 'active' or staff
  );
end $$;

-- People in a community (and, for owners and admins, its requests and invites).
create or replace function public.community_people(p_id uuid)
returns table (id uuid, name text, avatar_url text, roles text[], role text, status text, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(nullif(btrim(p.full_name), ''), 'Member'), p.avatar_url, p.roles, m.role, m.status, coalesce(m.joined_at, m.created_at)
  from public.community_members m
  join public.communities c on c.id = m.community_id
  join public.profiles p on p.id = m.member_id
  where m.community_id = p_id and auth.uid() is not null
    and (
      (m.status = 'active' and (c.visibility = 'public' or public.cm_role(p_id, auth.uid()) is not null))
      or public.cm_is_admin(p_id, auth.uid())
      or public.has_any_perm('{community.view}'::text[]))
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.status, coalesce(m.joined_at, m.created_at)
  limit 1000;
$$;

-- ================================================================ reports on communities

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
  else
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  insert into public.reports (reporter, kind, target_id, target_member, reason, details, excerpt)
    values (me, p_kind, p_target, who, p_reason, nullif(btrim(coalesce(p_details, '')), ''), left(ex, 2000))
    returning id into rid;
  return rid;
end $$;

-- ================================================================ grants

revoke all on function public.cm_role(uuid, uuid), public.cm_is_admin(uuid, uuid), public.cm_notify_admins(uuid, text, text),
  public.blong_slug(text), public.blong_topics(text[]),
  public.create_community(text, text, text, text[], text[], text, text), public.update_community(uuid, text, text, text, text[], text[], text, text),
  public.set_community_status(uuid, text), public.delete_community(uuid), public.join_community(uuid), public.leave_community(uuid),
  public.respond_join(uuid, uuid, boolean), public.invite_to_community(uuid, uuid), public.set_community_role(uuid, uuid, text),
  public.remove_community_member(uuid, uuid), public.transfer_community(uuid, uuid),
  public.list_communities(text, text, text), public.community_page(text), public.community_people(uuid),
  public.report_content(text, uuid, text, text)
  from public;
-- The policies above call these two for every signed-in member.
grant execute on function public.cm_role(uuid, uuid), public.cm_is_admin(uuid, uuid) to authenticated;
grant execute on function
  public.create_community(text, text, text, text[], text[], text, text), public.update_community(uuid, text, text, text, text[], text[], text, text),
  public.set_community_status(uuid, text), public.delete_community(uuid), public.join_community(uuid), public.leave_community(uuid),
  public.respond_join(uuid, uuid, boolean), public.invite_to_community(uuid, uuid), public.set_community_role(uuid, uuid, text),
  public.remove_community_member(uuid, uuid), public.transfer_community(uuid, uuid),
  public.list_communities(text, text, text), public.community_page(text), public.community_people(uuid),
  public.report_content(text, uuid, text, text)
  to authenticated;
