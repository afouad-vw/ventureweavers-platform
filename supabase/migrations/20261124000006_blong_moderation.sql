-- Phase 19b (approved 2026-11-24): BLong automatic moderation. Plan: docs/phase-19-plan.md.
-- Rules the team sets in Admin › Community › Settings, checked in the database when members post:
--   blocked words (hold for review or reject), links (new members' links held; a maximum per message; blocked domains),
--   spam (the same text again within 10 minutes; too many messages a minute), new member limits (can't create
--   communities or discussions, can only message people who follow them, first posts held), and auto-hide after reports.
-- Held room messages are seen only by their author until staff publish or remove them (Admin › Community › Held).
-- Member-to-member messages are never held (staff never read private chats): a rule there refuses the message.

-- ================================================================ settings

alter table public.blong_settings
  add column blocked_words     text[] not null default '{}' check (cardinality(blocked_words) <= 500),
  add column blocked_action    text not null default 'hold' check (blocked_action in ('hold', 'reject')),
  add column blocked_domains   text[] not null default '{}' check (cardinality(blocked_domains) <= 200),
  add column max_links         int not null default 2 check (max_links between 0 and 20),
  add column link_new_days     int not null default 7 check (link_new_days between 0 and 90),
  add column per_minute        int not null default 6 check (per_minute between 1 and 60),
  add column new_member_days   int not null default 3 check (new_member_days between 0 and 90),
  add column new_member_hold   int not null default 2 check (new_member_hold between 0 and 20),
  add column auto_hide_reports int not null default 3 check (auto_hide_reports between 1 and 50);

-- ================================================================ held and hidden messages

alter table public.discussion_messages
  add column mod_status text not null default 'live' check (mod_status in ('live', 'held', 'hidden')),
  add column mod_rule   text;
create index discussion_messages_mod_idx on public.discussion_messages (mod_status) where mod_status <> 'live';

-- Held and hidden messages: only their author (and nobody else, staff included, outside the Held queue).
drop policy "Room messages are readable by people who can read the room" on public.discussion_messages;
create policy "Room messages are readable by people who can read the room" on public.discussion_messages
  for select to authenticated using (public.dr_can_read(discussion_id, auth.uid()) and (mod_status = 'live' or author = auth.uid()));

create table public.moderation_log (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('room_message', 'community', 'discussion')),
  target_id  uuid not null,
  member_id  uuid references public.profiles (id) on delete set null,
  rule       text not null,
  action     text not null check (action in ('held', 'hidden', 'published', 'removed', 'restored')),
  actor      uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index moderation_log_target_idx on public.moderation_log (kind, target_id, created_at desc);
create index moderation_log_member_idx on public.moderation_log (member_id, created_at desc);
alter table public.moderation_log enable row level security;
create policy "Community staff read the moderation log" on public.moderation_log
  for select to authenticated using (public.has_any_perm('{community.view}'::text[]));
grant select on public.moderation_log to authenticated;
grant all on public.moderation_log to service_role;

-- ================================================================ the rules

create or replace function public.blong_is_new(p_member uuid, p_days int) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select created_at > now() - make_interval(days => p_days) from public.profiles where id = p_member), false);
$$;

-- Number of links in a text (web addresses and bare domains with a common ending).
create or replace function public.blong_link_count(p_text text) returns int
language sql immutable set search_path = '' as $$
  select count(*)::int from regexp_matches(lower(coalesce(p_text, '')),
    '(https?://|www\.)\S+|\m[a-z0-9][a-z0-9-]*\.(com|net|org|io|co|me|ly|app|ai|eg|xyz|info|biz|link|site|online|store|shop)\M', 'g');
$$;

-- A blocked word or phrase as a whole word (letters or digits may not touch it), any case.
create or replace function public.blong_has_word(p_text text, p_word text) returns boolean
language sql immutable set search_path = '' as $$
  select btrim(coalesce(p_word, '')) <> '' and lower(coalesce(p_text, '')) ~
    ('(^|[^[:alnum:]_])' || regexp_replace(lower(btrim(p_word)), '([]\\.*+?^$(){}|[])', '\\\1', 'g') || '($|[^[:alnum:]_])');
$$;

-- Checks a text against the rules. Returns null when it can go live, or the rule that holds it for review.
-- Raises mod_* when the text is refused. p_where: room (discussion message), dm (member message), item (names and descriptions).
create or replace function public.blong_moderate(p_member uuid, p_text text, p_where text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.blong_settings;
  w text;
  links int := public.blong_link_count(p_text);
  hold text;
begin
  select * into s from public.blong_settings where id = 1;
  -- Blocked words
  foreach w in array s.blocked_words loop
    if public.blong_has_word(p_text, w) then
      if s.blocked_action = 'reject' or p_where = 'dm' then raise exception 'mod_blocked_word' using errcode = '22023'; end if;
      hold := coalesce(hold, 'blocked_word');
    end if;
  end loop;
  -- Links
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
  -- Spam: the same text again within 10 minutes, or too many messages in a minute
  if p_where = 'room' then
    if exists (select 1 from public.discussion_messages where author = p_member and body = btrim(p_text) and created_at > now() - interval '10 minutes') then
      raise exception 'mod_duplicate' using errcode = '22023';
    end if;
    if (select count(*) from public.discussion_messages where author = p_member and created_at > now() - interval '1 minute') >= s.per_minute then
      raise exception 'mod_slow_down' using errcode = '22023';
    end if;
    -- A new member's first messages wait for review.
    if public.blong_is_new(p_member, s.new_member_days)
       and (select count(*) from public.discussion_messages where author = p_member and mod_status = 'live') < s.new_member_hold then
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

-- ================================================================ discussion messages

-- Messages that pass go through the usual path; held ones are saved quietly (no reply notification, no "active" time).
create or replace function public.post_room_message(p_id uuid, p_body text, p_reply_to uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  body text := btrim(coalesce(p_body, ''));
  d public.discussions;
  rule text;
  mid uuid;
begin
  perform public.dr_need_live(p_id);
  if char_length(body) not between 1 and 2000 then raise exception 'bad_message' using errcode = '22023'; end if;
  select * into d from public.discussions where id = p_id;
  if d.id is null or public.dr_role(p_id, me) is null then raise exception 'not_a_room_member' using errcode = '42501'; end if;
  if d.status <> 'open' then raise exception 'room_closed' using errcode = '22023'; end if;
  rule := public.blong_moderate(me, body, 'room');
  if rule is null then return public.post_room_message__base(p_id, body, p_reply_to); end if;
  if (select count(*) from public.discussion_messages where author = me and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'too_many_messages' using errcode = '22023';
  end if;
  if p_reply_to is not null and not exists (select 1 from public.discussion_messages where id = p_reply_to and discussion_id = p_id and removed_at is null) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.discussion_messages (discussion_id, author, body, reply_to, mod_status, mod_rule)
    values (p_id, me, body, p_reply_to, 'held', rule) returning id into mid;
  insert into public.moderation_log (kind, target_id, member_id, rule, action) values ('room_message', mid, me, rule, 'held');
  return mid;
end $$;

-- Only live messages can be pinned.
create or replace function public.pin_room_message(p_id uuid, p_message uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.dr_need_live(p_id);
  if p_message is not null and not exists (select 1 from public.discussion_messages where id = p_message and mod_status = 'live') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform public.pin_room_message__base(p_id, p_message);
end $$;

-- Room messages for the page: held and hidden ones only for their author (with their state), and no quotes of them in replies.
alter function public.room_messages(uuid, timestamptz) rename to room_messages__base;
revoke all on function public.room_messages__base(uuid, timestamptz) from public, anon, authenticated;
create or replace function public.room_messages(p_id uuid, p_after timestamptz default null)
returns table (id uuid, author uuid, name text, avatar_url text, body text, removed boolean, reply_to uuid, reply_name text, reply_body text,
               created_at timestamptz, mod_status text)
language sql stable security definer set search_path = '' as $$
  select b.id, b.author, b.name, b.avatar_url, b.body, b.removed, b.reply_to, b.reply_name,
         case when r.id is null or r.mod_status = 'live' or r.author = auth.uid() then b.reply_body else '' end,
         b.created_at, m.mod_status
  from public.room_messages__base(p_id, p_after) b
  join public.discussion_messages m on m.id = b.id
  left join public.discussion_messages r on r.id = b.reply_to
  where m.mod_status = 'live' or m.author = auth.uid()
  order by b.created_at;
$$;

-- ================================================================ member messages and new members

create or replace function public.blong_follows_me(me uuid, other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.follows where follower = other and followee = me and status = 'accepted');
$$;

alter function public.start_dm(uuid) rename to start_dm__base;
alter function public.send_dm(uuid, text) rename to send_dm__base;
revoke all on function public.start_dm__base(uuid), public.send_dm__base(uuid, text) from public, anon, authenticated;

-- New members message only people who follow them (or who wrote to them first).
create or replace function public.start_dm(p_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  t uuid;
begin
  if public.blong_is_new(me, (select new_member_days from public.blong_settings where id = 1)) and not public.blong_follows_me(me, p_id) then
    select id into t from public.dm_threads where a = least(me, p_id) and b = greatest(me, p_id);
    if t is null or not exists (select 1 from public.dm_messages where thread_id = t and author = p_id) then
      raise exception 'mod_new_member' using errcode = '22023';
    end if;
  end if;
  return public.start_dm__base(p_id);
end $$;

create or replace function public.send_dm(p_thread uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  t public.dm_threads;
  other uuid;
begin
  select * into t from public.dm_threads where id = p_thread;
  if t.id is not null and me in (t.a, t.b) then
    other := case when me = t.a then t.b else t.a end;
    if public.blong_is_new(me, (select new_member_days from public.blong_settings where id = 1)) and not public.blong_follows_me(me, other)
       and not exists (select 1 from public.dm_messages where thread_id = t.id and author = other) then
      raise exception 'mod_new_member' using errcode = '22023';
    end if;
    perform public.blong_moderate(me, p_body, 'dm');
  end if;
  perform public.send_dm__base(p_thread, p_body);
end $$;

-- ================================================================ communities and discussions

-- New members can't create them; names and descriptions go through the rules (a hold sends them for approval).
create or replace function public.create_community(
  p_name text, p_description text, p_type text, p_topics text[], p_audience text[], p_visibility text, p_cover text default null
) returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  s text;
  rule text;
begin
  perform public.blong_need('communities');
  if public.blong_is_new(me, (select new_member_days from public.blong_settings where id = 1)) then raise exception 'mod_new_member' using errcode = '22023'; end if;
  rule := public.blong_moderate(me, coalesce(p_name, '') || E'\n' || coalesce(p_description, '') || E'\n' || array_to_string(coalesce(p_topics, '{}'), ' '), 'item');
  s := public.create_community__base(p_name, p_description, p_type, p_topics, p_audience, p_visibility, p_cover);
  if rule is not null or (select approve_communities from public.blong_settings where id = 1) then
    update public.communities set status = 'pending' where slug = s;
  end if;
  if rule is not null then
    insert into public.moderation_log (kind, target_id, member_id, rule, action) select 'community', id, me, rule, 'held' from public.communities where slug = s;
  end if;
  return s;
end $$;

create or replace function public.update_community(
  p_id uuid, p_name text, p_description text, p_type text, p_topics text[], p_audience text[], p_visibility text, p_cover text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  rule text;
begin
  perform public.blong_need('communities');
  rule := public.blong_moderate(me, coalesce(p_name, '') || E'\n' || coalesce(p_description, '') || E'\n' || array_to_string(coalesce(p_topics, '{}'), ' '), 'item');
  perform public.update_community__base(p_id, p_name, p_description, p_type, p_topics, p_audience, p_visibility, p_cover);
  update public.communities set status = 'pending', resubmitted = true where id = p_id and status = 'declined' and not resubmitted;
  if rule is not null then
    update public.communities set status = 'pending' where id = p_id and status = 'active';
    insert into public.moderation_log (kind, target_id, member_id, rule, action) values ('community', p_id, me, rule, 'held');
  end if;
end $$;

create or replace function public.create_discussion(
  p_title text, p_description text, p_category text, p_tags text[], p_limit int, p_privacy text, p_community uuid default null
) returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  s text;
  rule text;
begin
  perform public.blong_need('discussions');
  if p_community is not null then perform public.blong_need('communities'); end if;
  if public.blong_is_new(me, (select new_member_days from public.blong_settings where id = 1)) then raise exception 'mod_new_member' using errcode = '22023'; end if;
  rule := public.blong_moderate(me, coalesce(p_title, '') || E'\n' || coalesce(p_description, '') || E'\n' || array_to_string(coalesce(p_tags, '{}'), ' '), 'item');
  s := public.create_discussion__base(p_title, p_description, p_category, p_tags, p_limit, p_privacy, p_community);
  if rule is not null or (select approve_discussions from public.blong_settings where id = 1) then
    update public.discussions set status = 'pending' where slug = s;
  end if;
  if rule is not null then
    insert into public.moderation_log (kind, target_id, member_id, rule, action) select 'discussion', id, me, rule, 'held' from public.discussions where slug = s;
  end if;
  return s;
end $$;

create or replace function public.update_discussion(
  p_id uuid, p_title text, p_description text, p_category text, p_tags text[], p_limit int, p_privacy text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.blong_guard();
  cid uuid;
  rule text;
begin
  perform public.blong_need('discussions');
  select community_id into cid from public.discussions where id = p_id;
  if cid is not null then perform public.blong_need('communities'); end if;
  rule := public.blong_moderate(me, coalesce(p_title, '') || E'\n' || coalesce(p_description, '') || E'\n' || array_to_string(coalesce(p_tags, '{}'), ' '), 'item');
  perform public.update_discussion__base(p_id, p_title, p_description, p_category, p_tags, p_limit, p_privacy);
  update public.discussions set status = 'pending', resubmitted = true where id = p_id and status = 'declined' and not resubmitted;
  if rule is not null then
    update public.discussions set status = 'pending' where id = p_id and status in ('open', 'closed');
    insert into public.moderation_log (kind, target_id, member_id, rule, action) values ('discussion', p_id, me, rule, 'held');
  end if;
end $$;

-- ================================================================ auto-hide after reports

create or replace function public.reports_auto_hide() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  n int;
  limit_ int := (select auto_hide_reports from public.blong_settings where id = 1);
  who uuid;
  v_title text;
  v_slug text;
begin
  if new.kind not in ('room_message', 'community', 'discussion') then return null; end if;
  select count(distinct reporter) into n from public.reports where kind = new.kind and target_id = new.target_id and status = 'open';
  if n < limit_ then return null; end if;
  if new.kind = 'room_message' then
    update public.discussion_messages set mod_status = 'hidden', mod_rule = 'reports'
      where id = new.target_id and mod_status = 'live' and removed_at is null returning author into who;
    if who is not null then
      insert into public.moderation_log (kind, target_id, member_id, rule, action) values ('room_message', new.target_id, who, 'reports', 'hidden');
      update public.discussions set pinned_message = null where pinned_message = new.target_id;
    end if;
  elsif new.kind = 'community' then
    update public.communities set status = 'archived', archived_by_team = true
      where id = new.target_id and status = 'active' returning owner, name, slug into who, v_title, v_slug;
    if who is not null then
      insert into public.moderation_log (kind, target_id, member_id, rule, action) values ('community', new.target_id, who, 'reports', 'hidden');
      perform public.notify(who, 'Your community ' || v_title || ' is hidden while the team reviews reports about it.', '/blong/communities/' || v_slug);
    end if;
  else
    update public.discussions set status = 'archived', archived_by_team = true
      where id = new.target_id and status in ('open', 'closed') returning owner, discussions.title, discussions.slug into who, v_title, v_slug;
    if who is not null then
      insert into public.moderation_log (kind, target_id, member_id, rule, action) values ('discussion', new.target_id, who, 'reports', 'hidden');
      perform public.notify(who, 'Your discussion ' || v_title || ' is hidden while the team reviews reports about it.', '/blong/discussions/' || v_slug);
    end if;
  end if;
  return null;
end $$;
create trigger reports_auto_hide after insert on public.reports for each row execute function public.reports_auto_hide();

-- ================================================================ staff: Held queue, watch list, rules

-- Room messages waiting for review (held by a rule) or hidden after reports. Staff read only these.
create or replace function public.blong_held()
returns table (id uuid, body text, mod_status text, mod_rule text, author_id uuid, author_name text, room_title text, room_slug text,
               reports int, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_any_perm('{community.view}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  return query
    select m.id, m.body, m.mod_status, m.mod_rule, m.author, coalesce(nullif(btrim(p.full_name), ''), 'Member'), d.title, d.slug,
           (select count(*)::int from public.reports r where r.kind = 'room_message' and r.target_id = m.id and r.status = 'open'), m.created_at
    from public.discussion_messages m
    join public.discussions d on d.id = m.discussion_id
    join public.profiles p on p.id = m.author
    where m.mod_status in ('held', 'hidden') and m.removed_at is null
    order by m.created_at;
end $$;

-- Publish (goes live) or remove a held or hidden message. Open reports on it are closed; the author is told.
create or replace function public.review_held_message(p_id uuid, p_publish boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.discussion_messages;
  d public.discussions;
begin
  if not public.has_any_perm('{community.manage}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  select * into m from public.discussion_messages where id = p_id and mod_status in ('held', 'hidden') and removed_at is null for update;
  if m.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into d from public.discussions where id = m.discussion_id;
  if p_publish then
    update public.discussion_messages set mod_status = 'live' where id = p_id;
    if m.mod_status = 'held' then update public.discussions set last_message_at = greatest(coalesce(last_message_at, m.created_at), m.created_at) where id = d.id; end if;
    perform public.notify(m.author, 'Your message in ' || d.title || ' is now visible.', '/blong/discussions/' || d.slug);
  else
    update public.discussion_messages set mod_status = 'live', body = '[removed]', removed_at = now(), removed_by = auth.uid() where id = p_id;
    perform public.notify(m.author, 'The team removed a message of yours in ' || d.title || '.', '/blong/discussions/' || d.slug);
  end if;
  update public.reports set status = case when p_publish then 'dismissed' else 'handled' end, handled_by = auth.uid(), handled_at = now(),
         note = coalesce(note, case when p_publish then 'Published from the Held queue.' else 'Removed from the Held queue.' end)
   where kind = 'room_message' and target_id = p_id and status = 'open';
  insert into public.moderation_log (kind, target_id, member_id, rule, action, actor)
    values ('room_message', p_id, m.author, coalesce(m.mod_rule, 'review'), case when p_publish then 'published' else 'removed' end, auth.uid());
end $$;

-- Members caught by the rules five or more times in the last 7 days.
create or replace function public.blong_watch()
returns table (member_id uuid, name text, caught int, last_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_any_perm('{community.view}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  return query
    select l.member_id, coalesce(nullif(btrim(p.full_name), ''), 'Member'), count(*)::int, max(l.created_at)
    from public.moderation_log l join public.profiles p on p.id = l.member_id
    where l.action in ('held', 'hidden') and l.created_at > now() - interval '7 days'
    group by l.member_id, p.full_name
    having count(*) >= 5
    order by count(*) desc;
end $$;

-- Moderation numbers for the Overview.
create or replace function public.blong_mod_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_any_perm('{community.view}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  return jsonb_build_object(
    'held_now', (select count(*) from public.discussion_messages where mod_status = 'held' and removed_at is null),
    'hidden_now', (select count(*) from public.discussion_messages where mod_status = 'hidden' and removed_at is null),
    'held_30', (select count(*) from public.moderation_log where action = 'held' and created_at > now() - interval '30 days'),
    'hidden_30', (select count(*) from public.moderation_log where action = 'hidden' and created_at > now() - interval '30 days'),
    'removed_30', (select count(*) from public.moderation_log where action = 'removed' and created_at > now() - interval '30 days'));
end $$;

-- Settings now include the rules. Lists are cleaned: trimmed, lower case, no duplicates, up to 40 characters a word.
create or replace function public.set_blong_settings(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  was jsonb;
  now_ jsonb;
  words text[];
  domains text[];
begin
  if not public.has_any_perm('{community.manage}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  if p ? 'blocked_words' then
    select coalesce(array_agg(distinct left(lower(btrim(x)), 40)) filter (where btrim(x) <> ''), '{}') into words from jsonb_array_elements_text(p -> 'blocked_words') x;
  end if;
  if p ? 'blocked_domains' then
    select coalesce(array_agg(distinct left(regexp_replace(lower(btrim(x)), '^(https?://)?(www\.)?', ''), 100)) filter (where btrim(x) <> ''), '{}')
      into domains from jsonb_array_elements_text(p -> 'blocked_domains') x;
  end if;
  select to_jsonb(s) into was from public.blong_settings s where s.id = 1;
  update public.blong_settings set
    communities_on      = coalesce((p ->> 'communities_on')::boolean, communities_on),
    discussions_on      = coalesce((p ->> 'discussions_on')::boolean, discussions_on),
    approve_communities = coalesce((p ->> 'approve_communities')::boolean, approve_communities),
    approve_discussions = coalesce((p ->> 'approve_discussions')::boolean, approve_discussions),
    blocked_words       = coalesce(words, blocked_words),
    blocked_action      = coalesce(p ->> 'blocked_action', blocked_action),
    blocked_domains     = coalesce(domains, blocked_domains),
    max_links           = coalesce((p ->> 'max_links')::int, max_links),
    link_new_days       = coalesce((p ->> 'link_new_days')::int, link_new_days),
    per_minute          = coalesce((p ->> 'per_minute')::int, per_minute),
    new_member_days     = coalesce((p ->> 'new_member_days')::int, new_member_days),
    new_member_hold     = coalesce((p ->> 'new_member_hold')::int, new_member_hold),
    auto_hide_reports   = coalesce((p ->> 'auto_hide_reports')::int, auto_hide_reports),
    updated_by = auth.uid(), updated_at = now()
  where id = 1;
  select to_jsonb(s) into now_ from public.blong_settings s where s.id = 1;
  insert into public.audit_log (actor, action, entity, entity_id, before, after)
    values (auth.uid(), 'blong.settings', 'blong_settings', '1', was, now_);
end $$;

-- ================================================================ grants

revoke all on function public.blong_is_new(uuid, int), public.blong_link_count(text), public.blong_has_word(text, text),
  public.blong_moderate(uuid, text, text), public.blong_follows_me(uuid, uuid), public.reports_auto_hide(),
  public.post_room_message(uuid, text, uuid), public.pin_room_message(uuid, uuid), public.room_messages(uuid, timestamptz),
  public.start_dm(uuid), public.send_dm(uuid, text),
  public.create_community(text, text, text, text[], text[], text, text), public.update_community(uuid, text, text, text, text[], text[], text, text),
  public.create_discussion(text, text, text, text[], int, text, uuid), public.update_discussion(uuid, text, text, text, text[], int, text),
  public.blong_held(), public.review_held_message(uuid, boolean), public.blong_watch(), public.blong_mod_stats(), public.set_blong_settings(jsonb)
  from public;
grant execute on function
  public.post_room_message(uuid, text, uuid), public.pin_room_message(uuid, uuid), public.room_messages(uuid, timestamptz),
  public.start_dm(uuid), public.send_dm(uuid, text),
  public.create_community(text, text, text, text[], text[], text, text), public.update_community(uuid, text, text, text, text[], text[], text, text),
  public.create_discussion(text, text, text, text[], int, text, uuid), public.update_discussion(uuid, text, text, text, text[], int, text),
  public.blong_held(), public.review_held_message(uuid, boolean), public.blong_watch(), public.blong_mod_stats(), public.set_blong_settings(jsonb)
  to authenticated;
