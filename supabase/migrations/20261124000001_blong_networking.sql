-- Phase 18a (approved 2026-11-24): BLong networking. Plan: docs/phase-18-plan.md.
-- Account privacy (Public / Private, Private by default), member cards, follows and follow requests,
-- blocks, one-to-one member messages and reports, plus the admin access area "community".
-- Communities (18b), discussions (18c) and the activity feed (18d) come next.

-- ================================================================ access area

create or replace function public.admin_perm_list() returns text[] language sql immutable set search_path = '' as $$
  select array[
    'overview.view',
    'contacts.view', 'contacts.manage',
    'businesses.view', 'businesses.manage',
    'projects.view', 'projects.manage',
    'requests.view', 'requests.manage',
    'messages.view', 'messages.manage',
    'community.view', 'community.manage',
    'payments.view', 'payments.manage',
    'events.view', 'events.manage',
    'checkin.manage',
    'live.manage',
    'content.view', 'content.manage',
    'tvs.view', 'tvs.manage',
    'classroom.view', 'classroom.manage',
    'brickr.view', 'brickr.manage',
    'quidquo.view', 'quidquo.manage',
    'library.view', 'library.manage',
    'publishing.manage'
  ]::text[];
$$;

-- ================================================================ profile: privacy, bio, links

alter table public.profiles
  add column visibility    text not null default 'private' check (visibility in ('public', 'private')),
  add column bio           text check (bio is null or char_length(bio) <= 300),
  add column links         jsonb not null default '[]'::jsonb,
  add column show_activity text[] not null default '{events,programs,communities,posts}'
    check (show_activity <@ array['events', 'programs', 'communities', 'posts']::text[]);

-- Up to 5 links, each {label (1-40), url (https, up to 200)}.
create or replace function public.is_profile_links(v jsonb) returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'array' and jsonb_array_length(v) <= 5 and not exists (
    select 1 from jsonb_array_elements(v) e
    where jsonb_typeof(e) <> 'object'
       or char_length(coalesce(e ->> 'label', '')) not between 1 and 40
       or char_length(coalesce(e ->> 'url', '')) not between 9 and 200
       or (e ->> 'url') !~ '^https://[^\s<>"]+\.[^\s<>"]+$');
$$;
alter table public.profiles add constraint profiles_links_check check (public.is_profile_links(links));

-- ================================================================ tables

create table public.follows (
  follower    uuid not null references public.profiles (id) on delete cascade,
  followee    uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (follower, followee),
  check (follower <> followee)
);
create index follows_followee_idx on public.follows (followee, status);

create table public.blocks (
  blocker    uuid not null references public.profiles (id) on delete cascade,
  blocked    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index blocks_blocked_idx on public.blocks (blocked);

-- One thread per pair of members, stored with a < b.
create table public.dm_threads (
  id              uuid primary key default gen_random_uuid(),
  a               uuid not null references public.profiles (id) on delete cascade,
  b               uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  a_read_at       timestamptz,
  b_read_at       timestamptz,
  created_at      timestamptz not null default now(),
  check (a < b),
  unique (a, b)
);
create index dm_threads_b_idx on public.dm_threads (b);

create table public.dm_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.dm_threads (id) on delete cascade,
  author     uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default clock_timestamp()
);
create index dm_messages_thread_idx on public.dm_messages (thread_id, created_at);
create index dm_messages_author_idx on public.dm_messages (author, created_at);

create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter      uuid not null references public.profiles (id) on delete cascade,
  kind          text not null check (kind in ('member', 'message', 'community', 'discussion', 'room_message')),
  target_id     uuid not null,
  target_member uuid references public.profiles (id) on delete set null,
  reason        text not null check (reason in ('spam', 'harassment', 'inappropriate', 'impersonation', 'privacy', 'other')),
  details       text check (details is null or char_length(details) <= 1000),
  excerpt       text check (excerpt is null or char_length(excerpt) <= 2000),
  status        text not null default 'open' check (status in ('open', 'handled', 'dismissed')),
  note          text check (note is null or char_length(note) <= 1000),
  handled_by    uuid references auth.users (id) on delete set null,
  handled_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);

alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;
alter table public.reports enable row level security;

create policy "Members see follows they are part of" on public.follows
  for select to authenticated using (follower = auth.uid() or followee = auth.uid());
create policy "Members see who they blocked" on public.blocks
  for select to authenticated using (blocker = auth.uid());
create policy "Members see their own chats" on public.dm_threads
  for select to authenticated using (auth.uid() in (a, b));
create policy "Members see messages in their own chats" on public.dm_messages
  for select to authenticated using (exists (select 1 from public.dm_threads t where t.id = thread_id and auth.uid() in (t.a, t.b)));
create policy "Reporters see their reports; Community viewers see all" on public.reports
  for select to authenticated using (reporter = auth.uid() or public.has_any_perm('{community.view}'::text[]));

grant select on public.follows, public.blocks, public.dm_threads, public.dm_messages, public.reports to authenticated;
grant all on public.follows, public.blocks, public.dm_threads, public.dm_messages, public.reports to service_role;
-- Writes go through the functions below only. Staff never read member chats directly:
-- a reported message is copied into the report (excerpt) and that is all they see.

-- ================================================================ helpers

create or replace function public.blong_blocked(x uuid, y uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks where (blocker = x and blocked = y) or (blocker = y and blocked = x));
$$;

-- A member who can take part: has a profile, is not an admin account and is not suspended.
create or replace function public.blong_member(x uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = x)
     and not exists (select 1 from public.admin_users where user_id = x)
     and not exists (select 1 from public.member_suspensions where member_id = x);
$$;

-- What a viewer may see of a member: everything for themselves, Public accounts and accepted followers.
create or replace function public.blong_can_see(viewer uuid, target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select viewer = target or (
    not public.blong_blocked(viewer, target)
    and public.blong_member(target)
    and (
      (select visibility from public.profiles where id = target) = 'public'
      or exists (select 1 from public.follows where follower = viewer and followee = target and status = 'accepted')
    ));
$$;

create or replace function public.blong_follow_state(viewer uuid, target uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select case status when 'accepted' then 'following' else 'requested' end
                   from public.follows where follower = viewer and followee = target), 'none');
$$;

create or replace function public.blong_guard() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if not public.blong_member(me) then raise exception 'not_a_member' using errcode = '42501'; end if;
  return me;
end $$;

-- ================================================================ member cards and the directory

-- Members to follow: everyone who finished sign-up, minus admin accounts, suspended members and blocks.
create or replace function public.member_directory(p_q text default null, p_role text default null, p_limit int default 60, p_offset int default 0)
returns table (id uuid, name text, avatar_url text, roles text[], country text, visibility text, follow_state text, follows_me boolean, business text)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(nullif(btrim(p.full_name), ''), 'Member'), p.avatar_url, p.roles, p.country, p.visibility,
         public.blong_follow_state(auth.uid(), p.id),
         exists (select 1 from public.follows f where f.follower = p.id and f.followee = auth.uid() and f.status = 'accepted'),
         (select mb.name from public.member_businesses mb where mb.member_id = p.id order by mb.position limit 1)
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and p.onboarded_at is not null
    and public.blong_member(p.id)
    and not public.blong_blocked(auth.uid(), p.id)
    and (p_role is null or p_role = any (p.roles))
    and (coalesce(btrim(p_q), '') = '' or p.full_name ilike '%' || btrim(p_q) || '%'
         or exists (select 1 from public.member_businesses mb where mb.member_id = p.id and mb.name ilike '%' || btrim(p_q) || '%'))
  order by p.full_name nulls last, p.id
  limit least(greatest(coalesce(p_limit, 60), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
$$;

-- One member's card: name, photo and roles for anyone who isn't blocked; the rest only when allowed.
-- Email and phone are never returned.
create or replace function public.member_card(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  p public.profiles;
  open_card boolean;
begin
  if me is null then return null; end if;
  if p_id <> me and (public.blong_blocked(me, p_id) or not public.blong_member(p_id)) then return null; end if;
  select * into p from public.profiles where id = p_id;
  if p.id is null then return null; end if;
  open_card := public.blong_can_see(me, p_id);
  return jsonb_build_object(
    'id', p.id,
    'name', coalesce(nullif(btrim(p.full_name), ''), 'Member'),
    'avatar_url', p.avatar_url,
    'roles', to_jsonb(p.roles),
    'visibility', p.visibility,
    'self', p_id = me,
    'open', open_card,
    'follow_state', public.blong_follow_state(me, p_id),
    'follows_me', exists (select 1 from public.follows where follower = p_id and followee = me and status = 'accepted'),
    'can_message', p_id <> me and open_card,
    'followers', (select count(*) from public.follows where followee = p_id and status = 'accepted'),
    'following', (select count(*) from public.follows where follower = p_id and status = 'accepted'),
    'bio', case when open_card then p.bio end,
    'country', case when open_card then p.country end,
    'linkedin', case when open_card then p.linkedin end,
    'links', case when open_card then p.links else '[]'::jsonb end,
    'businesses', case when open_card then coalesce((
      select jsonb_agg(jsonb_build_object('name', mb.name, 'type', mb.type, 'website', mb.website, 'role', mb.member_role) order by mb.position)
      from public.member_businesses mb where mb.member_id = p_id), '[]'::jsonb) else '[]'::jsonb end
  );
end $$;

-- People a member follows, follows them, or asked to: for the Networking tabs.
create or replace function public.my_network(p_kind text)
returns table (id uuid, name text, avatar_url text, roles text[], visibility text, follow_state text, follows_me boolean, since timestamptz)
language sql stable security definer set search_path = '' as $$
  with rows as (
    select f.followee as who, f.created_at as since from public.follows f
      where p_kind = 'following' and f.follower = auth.uid() and f.status = 'accepted'
    union all
    select f.follower, f.accepted_at from public.follows f
      where p_kind = 'followers' and f.followee = auth.uid() and f.status = 'accepted'
    union all
    select f.follower, f.created_at from public.follows f
      where p_kind = 'requests' and f.followee = auth.uid() and f.status = 'pending'
    union all
    select f.followee, f.created_at from public.follows f
      where p_kind = 'sent' and f.follower = auth.uid() and f.status = 'pending'
  )
  select p.id, coalesce(nullif(btrim(p.full_name), ''), 'Member'), p.avatar_url, p.roles, p.visibility,
         public.blong_follow_state(auth.uid(), p.id),
         exists (select 1 from public.follows f where f.follower = p.id and f.followee = auth.uid() and f.status = 'accepted'),
         r.since
  from rows r join public.profiles p on p.id = r.who
  where auth.uid() is not null and public.blong_member(p.id)
  order by r.since desc nulls last
  limit 500;
$$;

create or replace function public.my_blocked()
returns table (id uuid, name text, avatar_url text, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(nullif(btrim(p.full_name), ''), 'Member'), p.avatar_url, b.created_at
  from public.blocks b join public.profiles p on p.id = b.blocked
  where b.blocker = auth.uid()
  order by b.created_at desc;
$$;

-- ================================================================ follows

-- Public accounts: you follow at once. Private accounts: a request they accept or decline.
create or replace function public.follow_member(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  vis text;
  st text;
  who text;
begin
  if p_id = me then raise exception 'not_yourself' using errcode = '22023'; end if;
  if not public.blong_member(p_id) or public.blong_blocked(me, p_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  st := public.blong_follow_state(me, p_id);
  if st <> 'none' then return st; end if;
  if (select count(*) from public.follows where follower = me and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too_many_follows' using errcode = '22023';
  end if;
  select visibility into vis from public.profiles where id = p_id;
  select coalesce(nullif(btrim(full_name), ''), 'A member') into who from public.profiles where id = me;
  if vis = 'public' then
    insert into public.follows (follower, followee, status, accepted_at) values (me, p_id, 'accepted', now());
    perform public.notify(p_id, who || ' started following you.', '/blong/members/' || me);
    return 'following';
  end if;
  insert into public.follows (follower, followee, status) values (me, p_id, 'pending');
  perform public.notify(p_id, who || ' asked to follow you.', '/blong/networking?tab=requests');
  return 'requested';
end $$;

-- Unfollow, or take back a request.
create or replace function public.unfollow_member(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.blong_guard();
begin
  delete from public.follows where follower = me and followee = p_id;
end $$;

create or replace function public.respond_follow(p_follower uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  who text;
begin
  if p_accept then
    update public.follows set status = 'accepted', accepted_at = now()
      where follower = p_follower and followee = me and status = 'pending';
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    select coalesce(nullif(btrim(full_name), ''), 'A member') into who from public.profiles where id = me;
    perform public.notify(p_follower, who || ' accepted your follow request.', '/blong/members/' || me);
  else
    delete from public.follows where follower = p_follower and followee = me and status = 'pending';
  end if;
end $$;

create or replace function public.remove_follower(p_follower uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.blong_guard();
begin
  delete from public.follows where follower = p_follower and followee = me;
end $$;

-- Going Public accepts every waiting request.
create or replace function public.profiles_accept_requests() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.visibility = 'public' and old.visibility = 'private' then
    update public.follows set status = 'accepted', accepted_at = now() where followee = new.id and status = 'pending';
  end if;
  return new;
end $$;
create trigger profiles_accept_requests after update of visibility on public.profiles
  for each row execute function public.profiles_accept_requests();

-- ================================================================ blocks

-- Blocking removes follows both ways. A blocked member can't see your card, follow you or message you.
create or replace function public.block_member(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.blong_guard();
begin
  if p_id = me then raise exception 'not_yourself' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into public.blocks (blocker, blocked) values (me, p_id) on conflict do nothing;
  delete from public.follows where (follower = me and followee = p_id) or (follower = p_id and followee = me);
end $$;

create or replace function public.unblock_member(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.blong_guard();
begin
  delete from public.blocks where blocker = me and blocked = p_id;
end $$;

-- ================================================================ member messages

-- Whether `me` may write to `other` in a chat: not blocked either way, and either `other` is open to them
-- (Public, or `me` is an accepted follower) or `other` has already written to them in this chat.
create or replace function public.dm_can_send(me uuid, other uuid, p_thread uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.blong_member(me) and public.blong_member(other) and not public.blong_blocked(me, other)
     and (public.blong_can_see(me, other)
          or (p_thread is not null and exists (select 1 from public.dm_messages where thread_id = p_thread and author = other)));
$$;

-- Opens (or finds) the chat with a member. Returns its id.
create or replace function public.start_dm(p_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  lo uuid := least(me, p_id);
  hi uuid := greatest(me, p_id);
  t uuid;
begin
  if p_id = me then raise exception 'not_yourself' using errcode = '22023'; end if;
  select id into t from public.dm_threads where a = lo and b = hi;
  if not public.dm_can_send(me, p_id, t) then raise exception 'cannot_message' using errcode = '42501'; end if;
  if t is null then
    insert into public.dm_threads (a, b) values (lo, hi) on conflict (a, b) do nothing returning id into t;
    if t is null then select id into t from public.dm_threads where a = lo and b = hi; end if;
  end if;
  return t;
end $$;

create or replace function public.send_dm(p_thread uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  body text := btrim(coalesce(p_body, ''));
  t public.dm_threads;
  other uuid;
  other_read timestamptz;
  who text;
begin
  if char_length(body) not between 1 and 2000 then raise exception 'bad_message' using errcode = '22023'; end if;
  select * into t from public.dm_threads where id = p_thread for update;
  if t.id is null or me not in (t.a, t.b) then raise exception 'not_found' using errcode = 'P0002'; end if;
  other := case when me = t.a then t.b else t.a end;
  if not public.dm_can_send(me, other, t.id) then raise exception 'cannot_message' using errcode = '42501'; end if;
  if (select count(*) from public.dm_messages where author = me and created_at > now() - interval '1 hour') >= 50 then
    raise exception 'too_many_messages' using errcode = '22023';
  end if;
  other_read := case when other = t.a then t.a_read_at else t.b_read_at end;
  -- One bell notification per unread run: only when they had read everything we sent before.
  if not exists (select 1 from public.dm_messages where thread_id = t.id and author = me and (other_read is null or created_at > other_read)) then
    select coalesce(nullif(btrim(full_name), ''), 'A member') into who from public.profiles where id = me;
    perform public.notify(other, 'New message from ' || who || ': ' || left(body, 100), '/messages?tab=members&chat=' || t.id);
  end if;
  insert into public.dm_messages (thread_id, author, body) values (t.id, me, body);
  update public.dm_threads set last_message_at = clock_timestamp(),
    a_read_at = case when me = a then clock_timestamp() else a_read_at end,
    b_read_at = case when me = b then clock_timestamp() else b_read_at end
  where id = t.id;
end $$;

create or replace function public.mark_dm_read(p_thread uuid) returns void
language sql security definer set search_path = '' as $$
  update public.dm_threads set
    a_read_at = case when auth.uid() = a then clock_timestamp() else a_read_at end,
    b_read_at = case when auth.uid() = b then clock_timestamp() else b_read_at end
  where id = p_thread and auth.uid() in (a, b);
$$;

-- The member's chats, newest first, with the other person's name and photo (the app hides empty ones
-- except the chat being opened).
create or replace function public.my_dm_threads()
returns table (id uuid, other_id uuid, name text, avatar_url text, last_body text, last_mine boolean, last_message_at timestamptz, unread int, can_send boolean)
language sql stable security definer set search_path = '' as $$
  select t.id, o.id, coalesce(nullif(btrim(o.full_name), ''), 'Member'), o.avatar_url,
         lm.body, lm.author = auth.uid(), t.last_message_at,
         (select count(*)::int from public.dm_messages m where m.thread_id = t.id and m.author <> auth.uid()
            and m.created_at > coalesce(case when auth.uid() = t.a then t.a_read_at else t.b_read_at end, '-infinity'::timestamptz)),
         public.dm_can_send(auth.uid(), o.id, t.id)
  from public.dm_threads t
  join public.profiles o on o.id = case when auth.uid() = t.a then t.b else t.a end
  left join lateral (select m.body, m.author from public.dm_messages m where m.thread_id = t.id order by m.created_at desc limit 1) lm on true
  where auth.uid() in (t.a, t.b)
    and not exists (select 1 from public.blocks bl where bl.blocker = auth.uid() and bl.blocked = o.id)
  order by t.last_message_at desc
  limit 200;
$$;

create or replace function public.my_dm_unread() returns int
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(unread), 0)::int from public.my_dm_threads();
$$;

-- ================================================================ reports

-- A member reports a member or one of their messages. A reported message is copied into the report,
-- so staff see only that message, never the rest of the chat. Up to 10 reports a day.
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
  else
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  insert into public.reports (reporter, kind, target_id, target_member, reason, details, excerpt)
    values (me, p_kind, p_target, who, p_reason, nullif(btrim(coalesce(p_details, '')), ''), ex)
    returning id into rid;
  return rid;
end $$;

create or replace function public.admin_handle_report(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_any_perm('{community.manage}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_status not in ('open', 'handled', 'dismissed') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.reports set status = p_status, note = nullif(btrim(coalesce(p_note, '')), ''),
    handled_by = case when p_status = 'open' then null else auth.uid() end,
    handled_at = case when p_status = 'open' then null else now() end
  where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

-- ================================================================ grants

revoke all on function public.is_profile_links(jsonb), public.blong_blocked(uuid, uuid), public.blong_member(uuid),
  public.blong_can_see(uuid, uuid), public.blong_follow_state(uuid, uuid), public.blong_guard(),
  public.member_directory(text, text, int, int), public.member_card(uuid), public.my_network(text), public.my_blocked(),
  public.follow_member(uuid), public.unfollow_member(uuid), public.respond_follow(uuid, boolean), public.remove_follower(uuid),
  public.profiles_accept_requests(), public.block_member(uuid), public.unblock_member(uuid),
  public.dm_can_send(uuid, uuid, uuid), public.start_dm(uuid), public.send_dm(uuid, text), public.mark_dm_read(uuid),
  public.my_dm_threads(), public.my_dm_unread(), public.report_content(text, uuid, text, text), public.admin_handle_report(uuid, text, text)
  from public;
grant execute on function public.is_profile_links(jsonb) to authenticated, service_role;
grant execute on function public.member_directory(text, text, int, int), public.member_card(uuid), public.my_network(text), public.my_blocked(),
  public.follow_member(uuid), public.unfollow_member(uuid), public.respond_follow(uuid, boolean), public.remove_follower(uuid),
  public.block_member(uuid), public.unblock_member(uuid), public.start_dm(uuid), public.send_dm(uuid, text), public.mark_dm_read(uuid),
  public.my_dm_threads(), public.my_dm_unread(), public.report_content(text, uuid, text, text), public.admin_handle_report(uuid, text, text)
  to authenticated;

-- Live updates for member chats (Supabase Realtime respects the policies above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.dm_messages;
  end if;
end $$;
