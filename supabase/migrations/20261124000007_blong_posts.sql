-- Phase 19c (approved 2026-11-24): community post walls and engagement. Plan: docs/phase-19-plan.md.
-- Each community gets a Posts tab: members post (text, optional link and image), owners and admins can make it
-- "Only admins post", pin posts, close comments and remove posts. Comments with one level of replies.
-- Posts, comments and discussion messages get likes, bookmarks (My space › Saved), unique views and shares.
-- Everything goes through the 19b moderation rules (held posts and comments reach only their author) and can be reported.
-- Limits: 20 posts a day, 60 comments an hour, 300 likes an hour.

-- ================================================================ tables

alter table public.communities add column posting text not null default 'members' check (posting in ('members', 'admins'));

create table public.community_posts (
  id              uuid primary key default gen_random_uuid(),
  community_id    uuid not null references public.communities (id) on delete cascade,
  author          uuid not null references public.profiles (id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 3000),
  link_url        text check (link_url is null or (link_url ~ '^https://[^\s<>"]+$' and char_length(link_url) <= 500)),
  image_url       text check (image_url is null or char_length(image_url) <= 500),
  pinned          boolean not null default false,
  comments_closed boolean not null default false,
  mod_status      text not null default 'live' check (mod_status in ('live', 'held', 'hidden')),
  mod_rule        text,
  removed_at      timestamptz,
  removed_by      uuid,
  edited_at       timestamptz,
  created_at      timestamptz not null default clock_timestamp()
);
create index community_posts_wall_idx on public.community_posts (community_id, created_at desc) where removed_at is null;
create index community_posts_author_idx on public.community_posts (author, created_at desc);

create table public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  parent_id  uuid references public.post_comments (id) on delete cascade,
  author     uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  mod_status text not null default 'live' check (mod_status in ('live', 'held', 'hidden')),
  mod_rule   text,
  removed_at timestamptz,
  removed_by uuid,
  created_at timestamptz not null default clock_timestamp()
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);
create index post_comments_author_idx on public.post_comments (author, created_at desc);

-- Engagement on posts, comments and discussion messages.
create table public.blong_likes (
  target_kind text not null check (target_kind in ('post', 'comment', 'room_message')),
  target_id   uuid not null,
  member_id   uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default clock_timestamp(),
  primary key (target_kind, target_id, member_id)
);
create index blong_likes_member_idx on public.blong_likes (member_id, created_at desc);

create table public.blong_bookmarks (
  target_kind text not null check (target_kind in ('post', 'room_message')),
  target_id   uuid not null,
  member_id   uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default clock_timestamp(),
  primary key (target_kind, target_id, member_id)
);
create index blong_bookmarks_member_idx on public.blong_bookmarks (member_id, created_at desc);

create table public.blong_views (
  target_kind text not null check (target_kind in ('post', 'room_message')),
  target_id   uuid not null,
  member_id   uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default clock_timestamp(),
  primary key (target_kind, target_id, member_id)
);

create table public.blong_shares (
  target_kind text not null check (target_kind in ('post', 'room_message')),
  target_id   uuid not null,
  member_id   uuid not null references public.profiles (id) on delete cascade,
  channel     text not null check (channel in ('link', 'device', 'member')),
  day         date not null default (now() at time zone 'Africa/Cairo')::date,
  primary key (target_kind, target_id, member_id, channel, day)
);

alter table public.reports drop constraint reports_kind_check;
alter table public.reports add constraint reports_kind_check check (kind in ('member', 'message', 'community', 'discussion', 'room_message', 'post', 'comment'));
alter table public.moderation_log drop constraint moderation_log_kind_check;
alter table public.moderation_log add constraint moderation_log_kind_check check (kind in ('room_message', 'community', 'discussion', 'post', 'comment'));

-- ================================================================ who sees what

-- A post is visible to members who can see inside its community (Public, or a member), while Communities are on;
-- held and hidden posts only to their author.
create or replace function public.blong_post_visible(p_post uuid, p_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.community_posts p join public.communities c on c.id = p.community_id
    where p.id = p_post and p.removed_at is null
      and public.blong_member(p_member) and public.blong_on('communities') and c.status = 'active'
      and (c.visibility = 'public' or public.cm_role(c.id, p_member) is not null)
      and (p.mod_status = 'live' or p.author = p_member)
      and not public.blong_blocked(p_member, p.author));
$$;

create or replace function public.blong_target_visible(p_kind text, p_id uuid, p_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_kind
    when 'post' then public.blong_post_visible(p_id, p_member)
    when 'comment' then exists (select 1 from public.post_comments k where k.id = p_id and k.removed_at is null
                                and (k.mod_status = 'live' or k.author = p_member) and public.blong_post_visible(k.post_id, p_member))
    when 'room_message' then exists (select 1 from public.discussion_messages m where m.id = p_id and m.removed_at is null
                                and (m.mod_status = 'live' or m.author = p_member) and public.dr_can_read(m.discussion_id, p_member))
    else false end;
$$;

alter table public.community_posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.blong_likes enable row level security;
alter table public.blong_bookmarks enable row level security;
alter table public.blong_views enable row level security;
alter table public.blong_shares enable row level security;
create policy "Posts are readable by people who can see them" on public.community_posts
  for select to authenticated using (public.blong_post_visible(id, auth.uid()));
create policy "Comments are readable by people who can see them" on public.post_comments
  for select to authenticated using (public.blong_target_visible('comment', id, auth.uid()));
create policy "Members see their own likes" on public.blong_likes for select to authenticated using (member_id = auth.uid());
create policy "Members see their own bookmarks" on public.blong_bookmarks for select to authenticated using (member_id = auth.uid());
create policy "Members see their own views" on public.blong_views for select to authenticated using (member_id = auth.uid());
create policy "Members see their own shares" on public.blong_shares for select to authenticated using (member_id = auth.uid());
grant select on public.community_posts, public.post_comments, public.blong_likes, public.blong_bookmarks, public.blong_views, public.blong_shares to authenticated;
grant all on public.community_posts, public.post_comments, public.blong_likes, public.blong_bookmarks, public.blong_views, public.blong_shares to service_role;

-- ================================================================ moderation covers posts and comments

create or replace function public.blong_moderate(p_member uuid, p_text text, p_where text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.blong_settings;
  w text;
  links int := public.blong_link_count(p_text);
  hold text;
  recent int;
begin
  select * into s from public.blong_settings where id = 1;
  foreach w in array s.blocked_words loop
    if public.blong_has_word(p_text, w) then
      if s.blocked_action = 'reject' or p_where = 'dm' then raise exception 'mod_blocked_word' using errcode = '22023'; end if;
      hold := coalesce(hold, 'blocked_word');
    end if;
  end loop;
  foreach w in array s.blocked_domains loop
    if btrim(w) <> '' and position(lower(btrim(w)) in lower(coalesce(p_text, ''))) > 0 then
      raise exception 'mod_blocked_link' using errcode = '22023';
    end if;
  end loop;
  if links > s.max_links then raise exception 'mod_too_many_links' using errcode = '22023'; end if;
  if links > 0 and p_where <> 'item' and public.blong_is_new(p_member, s.link_new_days) then
    if p_where = 'dm' then raise exception 'mod_new_member_links' using errcode = '22023'; end if;
    hold := coalesce(hold, 'new_member_link');
  end if;
  if p_where in ('room', 'post', 'comment') then
    if exists (select 1 from public.discussion_messages where author = p_member and body = btrim(p_text) and created_at > now() - interval '10 minutes')
       or exists (select 1 from public.community_posts where author = p_member and body = btrim(p_text) and created_at > now() - interval '10 minutes')
       or exists (select 1 from public.post_comments where author = p_member and body = btrim(p_text) and created_at > now() - interval '10 minutes') then
      raise exception 'mod_duplicate' using errcode = '22023';
    end if;
    recent := (select count(*) from public.discussion_messages where author = p_member and created_at > now() - interval '1 minute')
            + (select count(*) from public.community_posts where author = p_member and created_at > now() - interval '1 minute')
            + (select count(*) from public.post_comments where author = p_member and created_at > now() - interval '1 minute');
    if recent >= s.per_minute then raise exception 'mod_slow_down' using errcode = '22023'; end if;
    if public.blong_is_new(p_member, s.new_member_days)
       and (select count(*) from public.discussion_messages where author = p_member and mod_status = 'live')
         + (select count(*) from public.community_posts where author = p_member and mod_status = 'live')
         + (select count(*) from public.post_comments where author = p_member and mod_status = 'live') < s.new_member_hold then
      hold := coalesce(hold, 'new_member');
    end if;
  elsif p_where = 'dm' then
    if exists (select 1 from public.dm_messages where author = p_member and body = btrim(p_text) and created_at > now() - interval '10 minutes') then
      raise exception 'mod_duplicate' using errcode = '22023';
    end if;
    if (select count(*) from public.dm_messages where author = p_member and created_at > now() - interval '1 minute') >= s.per_minute then
      raise exception 'mod_slow_down' using errcode = '22023';
    end if;
  end if;
  return hold;
end $$;

-- ================================================================ posts

create or replace function public.create_post(p_community uuid, p_body text, p_link text default null, p_image text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  body text := btrim(coalesce(p_body, ''));
  c public.communities;
  rule text;
  pid uuid;
begin
  perform public.cm_need_live(p_community);
  select * into c from public.communities where id = p_community and status = 'active';
  if c.id is null or public.cm_role(c.id, me) is null then raise exception 'not_in_community' using errcode = '42501'; end if;
  if c.posting = 'admins' and not public.cm_is_admin(c.id, me) then raise exception 'admins_only' using errcode = '42501'; end if;
  if char_length(body) not between 1 and 3000 then raise exception 'bad_post' using errcode = '22023'; end if;
  if p_image is not null and p_image !~ ('/content-images/communities/' || me::text || '/') then raise exception 'bad_image' using errcode = '22023'; end if;
  if (select count(*) from public.community_posts where author = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too_many_posts' using errcode = '22023';
  end if;
  rule := public.blong_moderate(me, body || coalesce(E'\n' || p_link, ''), 'post');
  insert into public.community_posts (community_id, author, body, link_url, image_url, mod_status, mod_rule)
    values (c.id, me, body, nullif(btrim(coalesce(p_link, '')), ''), p_image, case when rule is null then 'live' else 'held' end, rule)
    returning id into pid;
  if rule is not null then
    insert into public.moderation_log (kind, target_id, member_id, rule, action) values ('post', pid, me, rule, 'held');
  end if;
  return pid;
end $$;

-- Authors edit their posts; the rules check the new text (a hold takes the post off the wall until reviewed).
create or replace function public.update_post(p_id uuid, p_body text, p_link text default null, p_image text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  v_body text := btrim(coalesce(p_body, ''));
  p public.community_posts;
  rule text;
begin
  select * into p from public.community_posts where id = p_id and removed_at is null;
  if p.id is null or p.author <> me then raise exception 'not_allowed' using errcode = '42501'; end if;
  perform public.cm_need_live(p.community_id);
  if char_length(v_body) not between 1 and 3000 then raise exception 'bad_post' using errcode = '22023'; end if;
  if p_image is not null and p_image is distinct from p.image_url and p_image !~ ('/content-images/communities/' || me::text || '/') then
    raise exception 'bad_image' using errcode = '22023';
  end if;
  rule := public.blong_moderate(me, v_body || coalesce(E'\n' || p_link, ''), 'item');
  update public.community_posts set body = v_body, link_url = nullif(btrim(coalesce(p_link, '')), ''), image_url = p_image, edited_at = now(),
    mod_status = case when rule is not null and mod_status = 'live' then 'held' else mod_status end,
    mod_rule = case when rule is not null and mod_status = 'live' then rule else mod_rule end
  where id = p_id;
  if rule is not null and p.mod_status = 'live' then
    insert into public.moderation_log (kind, target_id, member_id, rule, action) values ('post', p_id, me, rule, 'held');
  end if;
end $$;

-- Authors remove their posts; community owners and admins remove any.
create or replace function public.remove_post(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  p public.community_posts;
begin
  select * into p from public.community_posts where id = p_id and removed_at is null;
  if p.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p.author <> me and not public.cm_is_admin(p.community_id, me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.community_posts set removed_at = now(), removed_by = me, pinned = false where id = p_id;
end $$;

-- Owners and admins: pin a post to the top of the wall, close or open its comments.
create or replace function public.set_post_flags(p_id uuid, p_pinned boolean default null, p_comments_closed boolean default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  p public.community_posts;
begin
  select * into p from public.community_posts where id = p_id and removed_at is null and mod_status = 'live';
  if p.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public.cm_need_live(p.community_id);
  if not public.cm_is_admin(p.community_id, me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.community_posts set pinned = coalesce(p_pinned, pinned), comments_closed = coalesce(p_comments_closed, comments_closed) where id = p_id;
end $$;

-- Owners and admins: who can post on the wall.
create or replace function public.set_community_posting(p_id uuid, p_posting text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.blong_guard();
begin
  perform public.cm_need_live(p_id);
  if not public.cm_is_admin(p_id, me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_posting not in ('members', 'admins') then raise exception 'bad_posting' using errcode = '22023'; end if;
  update public.communities set posting = p_posting where id = p_id;
end $$;

-- ================================================================ comments

-- One notice per post (or comment) per hour, so a busy thread doesn't flood the bell.
create or replace function public.blong_notify_once(p_member uuid, p_text text, p_href text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.notifications where member_id = p_member and href = p_href and created_at > now() - interval '1 hour') then
    perform public.notify(p_member, p_text, p_href);
  end if;
end $$;

create or replace function public.add_comment(p_post uuid, p_body text, p_parent uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  body text := btrim(coalesce(p_body, ''));
  p public.community_posts;
  c public.communities;
  parent public.post_comments;
  rule text;
  cid uuid;
  who text;
  href text;
begin
  select * into p from public.community_posts where id = p_post and removed_at is null and mod_status = 'live';
  if p.id is null or not public.blong_post_visible(p.id, me) then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public.cm_need_live(p.community_id);
  select * into c from public.communities where id = p.community_id;
  if public.cm_role(c.id, me) is null then raise exception 'not_in_community' using errcode = '42501'; end if;
  if p.comments_closed then raise exception 'comments_closed' using errcode = '22023'; end if;
  if char_length(body) not between 1 and 1000 then raise exception 'bad_comment' using errcode = '22023'; end if;
  if p_parent is not null then
    select * into parent from public.post_comments where id = p_parent and post_id = p.id and removed_at is null and mod_status = 'live';
    if parent.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if parent.parent_id is not null then p_parent := parent.parent_id; end if;  -- replies stay one level deep
  end if;
  if (select count(*) from public.post_comments where author = me and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'too_many_comments' using errcode = '22023';
  end if;
  rule := public.blong_moderate(me, body, 'comment');
  insert into public.post_comments (post_id, parent_id, author, body, mod_status, mod_rule)
    values (p.id, p_parent, me, body, case when rule is null then 'live' else 'held' end, rule)
    returning id into cid;
  if rule is not null then
    insert into public.moderation_log (kind, target_id, member_id, rule, action) values ('comment', cid, me, rule, 'held');
    return cid;
  end if;
  select coalesce(nullif(btrim(full_name), ''), 'A member') into who from public.profiles where id = me;
  href := '/blong/communities/' || c.slug || '?tab=posts&post=' || p.id;
  if p.author <> me and not public.blong_blocked(me, p.author) then
    perform public.blong_notify_once(p.author, who || ' commented on your post in ' || c.name || ': ' || left(body, 80), href);
  end if;
  if parent.id is not null and parent.author <> me and parent.author <> p.author and not public.blong_blocked(me, parent.author) then
    perform public.blong_notify_once(parent.author, who || ' replied to your comment in ' || c.name || ': ' || left(body, 80), href);
  end if;
  return cid;
end $$;

-- Authors, the post's author and community owners/admins remove comments.
create or replace function public.remove_comment(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  k public.post_comments;
  p public.community_posts;
begin
  select * into k from public.post_comments where id = p_id and removed_at is null;
  if k.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into p from public.community_posts where id = k.post_id;
  if k.author <> me and p.author <> me and not public.cm_is_admin(p.community_id, me) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.post_comments set removed_at = now(), removed_by = me where id = p_id;
end $$;

-- ================================================================ likes, bookmarks, views, shares

create or replace function public.toggle_like(p_kind text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  now_liked boolean;
begin
  if not public.blong_target_visible(p_kind, p_id, me) then raise exception 'not_found' using errcode = 'P0002'; end if;
  delete from public.blong_likes where target_kind = p_kind and target_id = p_id and member_id = me;
  if found then
    now_liked := false;
  else
    if (select count(*) from public.blong_likes where member_id = me and created_at > now() - interval '1 hour') >= 300 then
      raise exception 'too_many_likes' using errcode = '22023';
    end if;
    insert into public.blong_likes (target_kind, target_id, member_id) values (p_kind, p_id, me);
    now_liked := true;
  end if;
  return jsonb_build_object('liked', now_liked, 'likes', (select count(*) from public.blong_likes where target_kind = p_kind and target_id = p_id));
end $$;

create or replace function public.toggle_bookmark(p_kind text, p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.blong_guard();
begin
  if p_kind not in ('post', 'room_message') or not public.blong_target_visible(p_kind, p_id, me) then raise exception 'not_found' using errcode = 'P0002'; end if;
  delete from public.blong_bookmarks where target_kind = p_kind and target_id = p_id and member_id = me;
  if found then return false; end if;
  if (select count(*) from public.blong_bookmarks where member_id = me) >= 1000 then raise exception 'too_many_bookmarks' using errcode = '22023'; end if;
  insert into public.blong_bookmarks (target_kind, target_id, member_id) values (p_kind, p_id, me);
  return true;
end $$;

-- Counts each member once per item; only items they can see.
create or replace function public.record_views(p_kind text, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.blong_guard();
begin
  if p_kind not in ('post', 'room_message') then return; end if;
  insert into public.blong_views (target_kind, target_id, member_id)
  select p_kind, x, me from unnest(p_ids[1:100]) x
  where public.blong_target_visible(p_kind, x, me)
  on conflict do nothing;
end $$;

create or replace function public.record_share(p_kind text, p_id uuid, p_channel text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.blong_guard();
begin
  if p_kind not in ('post', 'room_message') or p_channel not in ('link', 'device', 'member') then raise exception 'bad_share' using errcode = '22023'; end if;
  if not public.blong_target_visible(p_kind, p_id, me) then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into public.blong_shares (target_kind, target_id, member_id, channel) values (p_kind, p_id, me, p_channel) on conflict do nothing;
end $$;

-- ================================================================ reading

create or replace function public.community_wall(p_community uuid, p_before timestamptz default null, p_post uuid default null)
returns table (id uuid, author uuid, name text, avatar_url text, body text, link_url text, image_url text, pinned boolean, comments_closed boolean,
               mod_status text, created_at timestamptz, edited_at timestamptz, likes int, comments int, views int, shares int, liked boolean, saved boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.author, coalesce(nullif(btrim(pr.full_name), ''), 'Member'), pr.avatar_url, p.body, p.link_url, p.image_url, p.pinned, p.comments_closed,
         p.mod_status, p.created_at, p.edited_at,
         (select count(*)::int from public.blong_likes l where l.target_kind = 'post' and l.target_id = p.id),
         (select count(*)::int from public.post_comments k where k.post_id = p.id and k.removed_at is null and k.mod_status = 'live'),
         (select count(*)::int from public.blong_views v where v.target_kind = 'post' and v.target_id = p.id),
         (select count(*)::int from public.blong_shares s where s.target_kind = 'post' and s.target_id = p.id),
         exists (select 1 from public.blong_likes l where l.target_kind = 'post' and l.target_id = p.id and l.member_id = auth.uid()),
         exists (select 1 from public.blong_bookmarks b where b.target_kind = 'post' and b.target_id = p.id and b.member_id = auth.uid())
  from public.community_posts p join public.profiles pr on pr.id = p.author
  where p.community_id = p_community and public.blong_post_visible(p.id, auth.uid())
    and (p_post is null or p.id = p_post)
    and (p_before is null or p.created_at < p_before)
  order by (p_before is null and p.pinned) desc, p.created_at desc
  limit 30;
$$;

create or replace function public.post_comments_list(p_post uuid)
returns table (id uuid, parent_id uuid, author uuid, name text, avatar_url text, body text, mod_status text, created_at timestamptz, likes int, liked boolean)
language sql stable security definer set search_path = '' as $$
  select k.id, k.parent_id, k.author, coalesce(nullif(btrim(pr.full_name), ''), 'Member'), pr.avatar_url, k.body, k.mod_status, k.created_at,
         (select count(*)::int from public.blong_likes l where l.target_kind = 'comment' and l.target_id = k.id),
         exists (select 1 from public.blong_likes l where l.target_kind = 'comment' and l.target_id = k.id and l.member_id = auth.uid())
  from public.post_comments k join public.profiles pr on pr.id = k.author
  where k.post_id = p_post and public.blong_post_visible(p_post, auth.uid()) and k.removed_at is null
    and (k.mod_status = 'live' or k.author = auth.uid())
    and not public.blong_blocked(auth.uid(), k.author)
  order by k.created_at
  limit 500;
$$;

-- Room messages with their likes, views, replies and the viewer's like and bookmark.
drop function public.room_messages(uuid, timestamptz);
create function public.room_messages(p_id uuid, p_after timestamptz default null)
returns table (id uuid, author uuid, name text, avatar_url text, body text, removed boolean, reply_to uuid, reply_name text, reply_body text,
               created_at timestamptz, mod_status text, likes int, liked boolean, saved boolean, views int, replies int)
language sql stable security definer set search_path = '' as $$
  select b.id, b.author, b.name, b.avatar_url, b.body, b.removed, b.reply_to, b.reply_name,
         case when r.id is null or r.mod_status = 'live' or r.author = auth.uid() then b.reply_body else '' end,
         b.created_at, m.mod_status,
         (select count(*)::int from public.blong_likes l where l.target_kind = 'room_message' and l.target_id = b.id),
         exists (select 1 from public.blong_likes l where l.target_kind = 'room_message' and l.target_id = b.id and l.member_id = auth.uid()),
         exists (select 1 from public.blong_bookmarks k where k.target_kind = 'room_message' and k.target_id = b.id and k.member_id = auth.uid()),
         (select count(*)::int from public.blong_views v where v.target_kind = 'room_message' and v.target_id = b.id),
         (select count(*)::int from public.discussion_messages x where x.reply_to = b.id and x.removed_at is null and x.mod_status = 'live')
  from public.room_messages__base(p_id, p_after) b
  join public.discussion_messages m on m.id = b.id
  left join public.discussion_messages r on r.id = b.reply_to
  where m.mod_status = 'live' or m.author = auth.uid()
  order by b.created_at;
$$;

-- My space › Saved › BLong: bookmarks that are still visible.
create or replace function public.my_saved()
returns table (kind text, id uuid, author text, body text, place text, href text, saved_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from (
    select 'post'::text, p.id, coalesce(nullif(btrim(pr.full_name), ''), 'Member'), left(p.body, 280), c.name,
           '/blong/communities/' || c.slug || '?tab=posts&post=' || p.id, b.created_at
    from public.blong_bookmarks b join public.community_posts p on p.id = b.target_id
    join public.communities c on c.id = p.community_id join public.profiles pr on pr.id = p.author
    where b.member_id = auth.uid() and b.target_kind = 'post' and public.blong_post_visible(p.id, auth.uid())
    union all
    select 'room_message', m.id, coalesce(nullif(btrim(pr.full_name), ''), 'Member'), left(m.body, 280), d.title,
           '/blong/discussions/' || d.slug, b.created_at
    from public.blong_bookmarks b join public.discussion_messages m on m.id = b.target_id
    join public.discussions d on d.id = m.discussion_id join public.profiles pr on pr.id = m.author
    where b.member_id = auth.uid() and b.target_kind = 'room_message' and public.blong_target_visible('room_message', m.id, auth.uid())
  ) x order by 7 desc limit 300;
$$;

-- The feed adds posts from your communities and from people you follow (communities you can see inside).
create or replace function public.blong_feed(p_limit int default 60)
returns table (member_id uuid, name text, avatar_url text, kind text, verb text, title text, href text, at timestamptz, starts_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from (
    select * from public.blong_feed__base(p_limit) a
    where not (a.href like '/blong/communities/%' and not public.blong_on('communities'))
    union all
    select p.author, coalesce(nullif(btrim(pr.full_name), ''), 'Member'), pr.avatar_url, 'post', 'Posted in ' || c.name, left(p.body, 140),
           '/blong/communities/' || c.slug || '?tab=posts&post=' || p.id, p.created_at, null::timestamptz
    from public.community_posts p join public.communities c on c.id = p.community_id join public.profiles pr on pr.id = p.author
    where p.author <> auth.uid() and p.mod_status = 'live' and p.created_at > now() - interval '120 days'
      and public.blong_post_visible(p.id, auth.uid())
      and (public.cm_role(c.id, auth.uid()) is not null
           or exists (select 1 from public.follows f where f.follower = auth.uid() and f.followee = p.author and f.status = 'accepted'))
  ) x order by at desc limit p_limit;
$$;

-- ================================================================ reports, auto-hide and the Held queue

alter function public.report_content(text, uuid, text, text) rename to report_content__base;
revoke all on function public.report_content__base(text, uuid, text, text) from public, anon, authenticated;
create or replace function public.report_content(p_kind text, p_target uuid, p_reason text, p_details text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  who uuid;
  ex text;
  rid uuid;
begin
  if p_kind not in ('post', 'comment') then return public.report_content__base(p_kind, p_target, p_reason, p_details); end if;
  if p_reason not in ('spam', 'harassment', 'inappropriate', 'impersonation', 'privacy', 'other') then raise exception 'bad_reason' using errcode = '22023'; end if;
  if char_length(coalesce(p_details, '')) > 1000 then raise exception 'bad_details' using errcode = '22023'; end if;
  if (select count(*) from public.reports where reporter = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too_many_reports' using errcode = '22023';
  end if;
  if p_kind = 'post' then
    select author, body || coalesce(E'\n' || link_url, '') into who, ex from public.community_posts where id = p_target and author <> me and public.blong_post_visible(id, me);
  else
    select author, body into who, ex from public.post_comments where id = p_target and author <> me and public.blong_target_visible('comment', id, me);
  end if;
  if who is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into public.reports (reporter, kind, target_id, target_member, reason, details, excerpt)
    values (me, p_kind, p_target, who, p_reason, nullif(btrim(coalesce(p_details, '')), ''), left(ex, 2000))
    returning id into rid;
  return rid;
end $$;

-- Posts and comments hide after enough reports too.
create or replace function public.reports_auto_hide_posts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  n int;
  who uuid;
begin
  if new.kind not in ('post', 'comment') then return null; end if;
  select count(distinct reporter) into n from public.reports where kind = new.kind and target_id = new.target_id and status = 'open';
  if n < (select auto_hide_reports from public.blong_settings where id = 1) then return null; end if;
  if new.kind = 'post' then
    update public.community_posts set mod_status = 'hidden', mod_rule = 'reports', pinned = false
      where id = new.target_id and mod_status = 'live' and removed_at is null returning author into who;
  else
    update public.post_comments set mod_status = 'hidden', mod_rule = 'reports'
      where id = new.target_id and mod_status = 'live' and removed_at is null returning author into who;
  end if;
  if who is not null then
    insert into public.moderation_log (kind, target_id, member_id, rule, action) values (new.kind, new.target_id, who, 'reports', 'hidden');
  end if;
  return null;
end $$;
create trigger reports_auto_hide_posts after insert on public.reports for each row execute function public.reports_auto_hide_posts();

-- The Held queue now lists posts and comments as well as discussion messages.
drop function public.blong_held();
create function public.blong_held()
returns table (kind text, id uuid, body text, mod_status text, mod_rule text, author_id uuid, author_name text, room_title text, room_slug text,
               reports int, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_any_perm('{community.view}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  return query
    select * from (
      select 'room_message'::text, m.id, m.body, m.mod_status, m.mod_rule, m.author, coalesce(nullif(btrim(p.full_name), ''), 'Member'),
             d.title, '/blong/discussions/' || d.slug,
             (select count(*)::int from public.reports r where r.kind = 'room_message' and r.target_id = m.id and r.status = 'open'), m.created_at
      from public.discussion_messages m join public.discussions d on d.id = m.discussion_id join public.profiles p on p.id = m.author
      where m.mod_status in ('held', 'hidden') and m.removed_at is null
      union all
      select 'post', x.id, x.body || coalesce(E'\n' || x.link_url, ''), x.mod_status, x.mod_rule, x.author, coalesce(nullif(btrim(p.full_name), ''), 'Member'),
             c.name, '/blong/communities/' || c.slug || '?tab=posts',
             (select count(*)::int from public.reports r where r.kind = 'post' and r.target_id = x.id and r.status = 'open'), x.created_at
      from public.community_posts x join public.communities c on c.id = x.community_id join public.profiles p on p.id = x.author
      where x.mod_status in ('held', 'hidden') and x.removed_at is null
      union all
      select 'comment', k.id, k.body, k.mod_status, k.mod_rule, k.author, coalesce(nullif(btrim(p.full_name), ''), 'Member'),
             c.name, '/blong/communities/' || c.slug || '?tab=posts&post=' || x.id,
             (select count(*)::int from public.reports r where r.kind = 'comment' and r.target_id = k.id and r.status = 'open'), k.created_at
      from public.post_comments k join public.community_posts x on x.id = k.post_id join public.communities c on c.id = x.community_id
      join public.profiles p on p.id = k.author
      where k.mod_status in ('held', 'hidden') and k.removed_at is null
    ) q order by 11;
end $$;

-- Publish or remove any held or hidden item; open reports are closed and the author is told.
create or replace function public.review_held(p_kind text, p_id uuid, p_publish boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  who uuid;
  st text;
  rule text;
  place text;
  href text;
begin
  if not public.has_any_perm('{community.manage}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_kind = 'room_message' then
    perform public.review_held_message(p_id, p_publish);
    return;
  elsif p_kind = 'post' then
    select x.author, x.mod_status, x.mod_rule, c.name, '/blong/communities/' || c.slug || '?tab=posts&post=' || x.id into who, st, rule, place, href
      from public.community_posts x join public.communities c on c.id = x.community_id
      where x.id = p_id and x.mod_status in ('held', 'hidden') and x.removed_at is null for update of x;
    if who is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    update public.community_posts set mod_status = 'live', removed_at = case when p_publish then null else now() end,
      removed_by = case when p_publish then null else auth.uid() end where id = p_id;
  elsif p_kind = 'comment' then
    select k.author, k.mod_status, k.mod_rule, c.name, '/blong/communities/' || c.slug || '?tab=posts&post=' || x.id into who, st, rule, place, href
      from public.post_comments k join public.community_posts x on x.id = k.post_id join public.communities c on c.id = x.community_id
      where k.id = p_id and k.mod_status in ('held', 'hidden') and k.removed_at is null for update of k;
    if who is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    update public.post_comments set mod_status = 'live', removed_at = case when p_publish then null else now() end,
      removed_by = case when p_publish then null else auth.uid() end where id = p_id;
  else
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  perform public.notify(who, case when p_publish then 'Your ' || replace(p_kind, '_', ' ') || ' in ' || place || ' is now visible.'
                                  else 'The team removed a ' || replace(p_kind, '_', ' ') || ' of yours in ' || place || '.' end, href);
  update public.reports set status = case when p_publish then 'dismissed' else 'handled' end, handled_by = auth.uid(), handled_at = now(),
         note = coalesce(note, case when p_publish then 'Published from the Held queue.' else 'Removed from the Held queue.' end)
   where kind = p_kind and target_id = p_id and status = 'open';
  insert into public.moderation_log (kind, target_id, member_id, rule, action, actor)
    values (p_kind, p_id, who, coalesce(rule, 'review'), case when p_publish then 'published' else 'removed' end, auth.uid());
end $$;

create or replace function public.blong_mod_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_any_perm('{community.view}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  return jsonb_build_object(
    'held_now', (select count(*) from public.discussion_messages where mod_status = 'held' and removed_at is null)
              + (select count(*) from public.community_posts where mod_status = 'held' and removed_at is null)
              + (select count(*) from public.post_comments where mod_status = 'held' and removed_at is null),
    'hidden_now', (select count(*) from public.discussion_messages where mod_status = 'hidden' and removed_at is null)
                + (select count(*) from public.community_posts where mod_status = 'hidden' and removed_at is null)
                + (select count(*) from public.post_comments where mod_status = 'hidden' and removed_at is null),
    'held_30', (select count(*) from public.moderation_log where action = 'held' and created_at > now() - interval '30 days'),
    'hidden_30', (select count(*) from public.moderation_log where action = 'hidden' and created_at > now() - interval '30 days'),
    'removed_30', (select count(*) from public.moderation_log where action = 'removed' and created_at > now() - interval '30 days'),
    'posts_30', (select count(*) from public.community_posts where created_at > now() - interval '30 days'),
    'comments_30', (select count(*) from public.post_comments where created_at > now() - interval '30 days'),
    'likes_30', (select count(*) from public.blong_likes where created_at > now() - interval '30 days'),
    'shares_30', (select count(*) from public.blong_shares where day > (now() - interval '30 days')::date),
    'saves_30', (select count(*) from public.blong_bookmarks where created_at > now() - interval '30 days'));
end $$;

-- The community page says who can post.
alter function public.community_page(text) rename to community_page__19a;
revoke all on function public.community_page__19a(text) from public, anon, authenticated;
create or replace function public.community_page(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare j jsonb;
begin
  j := public.community_page__19a(p_slug);
  if j is null then return null; end if;
  return j || jsonb_build_object('posting', (select posting from public.communities where id = (j ->> 'id')::uuid));
end $$;

-- ================================================================ grants

revoke all on function public.blong_post_visible(uuid, uuid), public.blong_target_visible(text, uuid, uuid), public.blong_moderate(uuid, text, text),
  public.create_post(uuid, text, text, text), public.update_post(uuid, text, text, text), public.remove_post(uuid), public.set_post_flags(uuid, boolean, boolean),
  public.set_community_posting(uuid, text), public.blong_notify_once(uuid, text, text), public.add_comment(uuid, text, uuid), public.remove_comment(uuid),
  public.toggle_like(text, uuid), public.toggle_bookmark(text, uuid), public.record_views(text, uuid[]), public.record_share(text, uuid, text),
  public.community_wall(uuid, timestamptz, uuid), public.post_comments_list(uuid), public.room_messages(uuid, timestamptz), public.my_saved(),
  public.blong_feed(int), public.report_content(text, uuid, text, text), public.reports_auto_hide_posts(), public.blong_held(),
  public.review_held(text, uuid, boolean), public.blong_mod_stats(), public.community_page(text)
  from public;
-- Policies call these for every signed-in member.
grant execute on function public.blong_post_visible(uuid, uuid), public.blong_target_visible(text, uuid, uuid) to authenticated;
grant execute on function
  public.create_post(uuid, text, text, text), public.update_post(uuid, text, text, text), public.remove_post(uuid), public.set_post_flags(uuid, boolean, boolean),
  public.set_community_posting(uuid, text), public.add_comment(uuid, text, uuid), public.remove_comment(uuid),
  public.toggle_like(text, uuid), public.toggle_bookmark(text, uuid), public.record_views(text, uuid[]), public.record_share(text, uuid, text),
  public.community_wall(uuid, timestamptz, uuid), public.post_comments_list(uuid), public.room_messages(uuid, timestamptz), public.my_saved(),
  public.blong_feed(int), public.report_content(text, uuid, text, text), public.blong_held(),
  public.review_held(text, uuid, boolean), public.blong_mod_stats(), public.community_page(text)
  to authenticated;

-- Live updates for walls (Realtime respects the policies above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.community_posts;
  end if;
end $$;
