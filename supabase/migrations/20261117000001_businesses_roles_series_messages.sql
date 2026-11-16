-- 2026-11-17 (approved): several businesses per member, several Ecosystem Roles, episode series,
-- Shorts pulled from @ventureweavers, and messages between members and the VentureWeavers team.

-- ================================================================ Ecosystem Roles (several per member)

create or replace function public.role_list() returns text[] language sql immutable set search_path = '' as $$
  select array['Founder', 'Investor or angel', 'Corporate innovator', 'Career professional', 'Expert or mentor', 'Exploring my first venture']::text[] $$;
create or replace function public.is_roles(v text[]) returns boolean language sql immutable set search_path = '' as $$
  select v is not null and cardinality(v) <= 6 and v <@ public.role_list() and cardinality(v) = (select count(distinct x) from unnest(v) x) $$;
revoke all on function public.role_list(), public.is_roles(text[]) from public;
grant execute on function public.role_list(), public.is_roles(text[]) to anon, authenticated, service_role;

alter table public.profiles add column roles text[] not null default '{}';
update public.profiles set roles = array[role] where role = any (public.role_list());
alter table public.profiles add constraint profiles_roles_check check (public.is_roles(roles));

-- "role" stays as the first Ecosystem Role, so everything that reads one role keeps working.
create or replace function public.profiles_sync_role() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.roles is distinct from old.roles then
    new.role := new.roles[1];
  elsif new.role is distinct from old.role then
    new.roles := case when new.role = any (public.role_list()) then array[new.role] || array_remove(new.roles, new.role) else new.roles end;
  end if;
  return new;
end $$;
create trigger profiles_sync_role before insert or update on public.profiles for each row execute function public.profiles_sync_role();

-- ================================================================ businesses (several per member)

create or replace function public.business_type_list() returns text[] language sql immutable set search_path = '' as $$
  select array['Venture', 'Angel Investor', 'Institutional investor', 'Corporate', 'Institutional Enabler', 'Venture Studio', 'Expert', 'Mentor', 'Other']::text[] $$;
revoke all on function public.business_type_list() from public;
grant execute on function public.business_type_list() to anon, authenticated, service_role;

create table public.member_businesses (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.profiles (id) on delete cascade,
  position   smallint not null default 0 check (position between 0 and 9),
  name       text not null check (char_length(name) between 1 and 120),
  type       text check (type is null or type = any (public.business_type_list())),
  website    text check (website is null or (char_length(website) <= 200 and website ~ '^https?://[^\s<>"]+\.[^\s<>"]+$')),
  member_role text check (member_role is null or char_length(member_role) between 1 and 80),
  linkedin   text check (linkedin is null or (char_length(linkedin) <= 200 and linkedin ~ '^https://www\.linkedin\.com/(company|school|showcase|in)/[^\s<>"]+$')),
  created_at timestamptz not null default now()
);
create index member_businesses_member_idx on public.member_businesses (member_id, position);
alter table public.member_businesses enable row level security;
create policy "Members see their businesses; Contacts viewers see all" on public.member_businesses
  for select to authenticated using (member_id = auth.uid() or public.has_any_perm('{contacts.view}'::text[]));
grant select on public.member_businesses to authenticated;
-- Writes go through set_my_businesses() and admin_update_member() only.

-- The single business from Phase 14 moves across.
insert into public.member_businesses (member_id, name, type, website)
select id, business_name,
       case business_type when 'Capital' then 'Institutional investor' when 'Government & non-profit' then 'Institutional Enabler'
                          when 'Education' then 'Other' else business_type end,
       business_website
from public.profiles where business_name is not null;

-- [{ "name", "type", "website", "member_role", "linkedin" }], at most 10. Checks happen in the table.
create or replace function public.write_businesses(p_member uuid, p_list jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i int := 0; x jsonb;
begin
  if p_list is null or jsonb_typeof(p_list) <> 'array' then raise exception 'bad_businesses' using errcode = '22023'; end if;
  if jsonb_array_length(p_list) > 10 then raise exception 'too_many_businesses' using errcode = '22023'; end if;
  delete from public.member_businesses where member_id = p_member;
  for x in select value from jsonb_array_elements(p_list) loop
    insert into public.member_businesses (member_id, position, name, type, website, member_role, linkedin)
    values (p_member, i, trim(x->>'name'), nullif(x->>'type', ''), nullif(trim(coalesce(x->>'website', '')), ''),
            nullif(trim(coalesce(x->>'member_role', '')), ''), nullif(trim(coalesce(x->>'linkedin', '')), ''));
    i := i + 1;
  end loop;
  return coalesce((select jsonb_agg(jsonb_build_object('name', name, 'type', type, 'website', website, 'member_role', member_role, 'linkedin', linkedin) order by position)
                   from public.member_businesses where member_id = p_member), '[]'::jsonb);
end $$;
revoke all on function public.write_businesses(uuid, jsonb) from public, anon, authenticated;

create or replace function public.set_my_businesses(p_list jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  perform public.write_businesses(auth.uid(), p_list);
end $$;
revoke all on function public.set_my_businesses(jsonb) from public;
grant execute on function public.set_my_businesses(jsonb) to authenticated;

-- Partners edit details from Contacts. Replaces the Phase 14 version: several roles and businesses.
drop function if exists public.admin_update_member(uuid, text, text, text, text, text, text[], text[], text, text, text);
create or replace function public.admin_update_member(
  p_member uuid, p_full_name text, p_phone text, p_linkedin text, p_country text, p_roles text[],
  p_goals text[], p_contact_prefs text[], p_businesses jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  old jsonb; new jsonb; old_biz jsonb; new_biz jsonb;
begin
  if not public.has_any_perm('{contacts.manage}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  if exists (select 1 from public.admin_users where user_id = p_member) then raise exception 'admin_account' using errcode = '42501'; end if;
  select jsonb_build_object('full_name', full_name, 'phone', phone, 'linkedin', linkedin, 'country', country, 'roles', roles, 'goals', goals, 'contact_prefs', contact_prefs)
    into old from public.profiles where id = p_member;
  if old is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if coalesce(char_length(trim(p_full_name)), 0) < 2 then raise exception 'bad_name' using errcode = '22023'; end if;
  if p_phone is null or p_phone !~ '^\+[0-9]{1,4} [0-9]{4,15}$' then raise exception 'bad_phone' using errcode = '22023'; end if;
  if not public.is_roles(p_roles) or cardinality(p_roles) = 0 then raise exception 'bad_roles' using errcode = '22023'; end if;
  if not (p_goals <@ array['Education', 'Services', 'Content', 'QuidQuo']::text[]) or cardinality(p_goals) = 0 then raise exception 'bad_interests' using errcode = '22023'; end if;
  if cardinality(p_contact_prefs) = 0 then raise exception 'bad_contact' using errcode = '22023'; end if;
  old_biz := coalesce((select jsonb_agg(jsonb_build_object('name', name, 'type', type, 'website', website, 'member_role', member_role, 'linkedin', linkedin) order by position)
                       from public.member_businesses where member_id = p_member), '[]'::jsonb);

  update public.profiles set
    full_name = left(trim(p_full_name), 120),
    phone = p_phone,
    linkedin = nullif(p_linkedin, ''),
    country = p_country,
    roles = p_roles,
    goals = p_goals,
    contact_prefs = p_contact_prefs,
    consent_whatsapp = 'WhatsApp' = any (p_contact_prefs)
  where id = p_member;
  new_biz := public.write_businesses(p_member, coalesce(p_businesses, '[]'::jsonb));

  select jsonb_build_object('full_name', full_name, 'phone', phone, 'linkedin', linkedin, 'country', country, 'roles', roles, 'goals', goals, 'contact_prefs', contact_prefs)
    into new from public.profiles where id = p_member;
  if new is distinct from old or new_biz is distinct from old_biz then
    insert into public.audit_log (actor, action, entity, entity_id, before, after)
    values (me, 'member.update', 'profile', p_member::text, old || jsonb_build_object('businesses', old_biz), new || jsonb_build_object('businesses', new_biz));
    perform public.notify(p_member, 'Your profile details were updated by the VentureWeavers team.', '/my-space?tab=profile');
  end if;
end $$;
revoke all on function public.admin_update_member(uuid, text, text, text, text, text[], text[], text[], jsonb) from public;
grant execute on function public.admin_update_member(uuid, text, text, text, text, text[], text[], text[], jsonb) to authenticated;

-- The old single-business columns are dropped in 20261117000002, once the new app is live.

-- ================================================================ episode series

create table public.content_series (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
insert into public.content_series (name, position)
select name, row_number() over () from (
  select unnest(array['Open Floor', 'The Question', 'In 60 Seconds', 'The Answer', 'Next Show', 'Full episodes', 'Shorts']) as name
  union select distinct series from public.content_items
) s on conflict (name) do nothing;
alter table public.content_items add constraint content_items_series_fkey
  foreign key (series) references public.content_series (name) on update cascade on delete restrict;

alter table public.content_series enable row level security;
create policy "Members read series" on public.content_series for select to authenticated using (true);
create policy "Content managers add series" on public.content_series for insert to authenticated with check (public.has_any_perm('{content.manage}'::text[]));
create policy "Content managers edit series" on public.content_series for update to authenticated using (public.has_any_perm('{content.manage}'::text[])) with check (public.has_any_perm('{content.manage}'::text[]));
create policy "Content managers delete series" on public.content_series for delete to authenticated using (public.has_any_perm('{content.manage}'::text[]));
grant select, insert, update, delete on public.content_series to authenticated;

-- ================================================================ Shorts pulled from @ventureweavers

alter table public.content_items
  add column source      text not null default 'manual' check (source in ('manual', 'youtube', 'instagram', 'tiktok')),
  add column external_id text check (external_id is null or char_length(external_id) <= 100),
  add column thumb_url   text check (thumb_url is null or (char_length(thumb_url) <= 1000 and thumb_url ~ '^https://[^\s<>"]+$'));
-- Manual items have no external id (nulls never clash); a synced post is stored once.
alter table public.content_items add constraint content_items_external_key unique (source, external_id);

-- When each source last ran. Written by the server (service role) only; content viewers can read it.
create table public.social_sync (
  source     text primary key check (source in ('youtube', 'instagram', 'tiktok')),
  last_run_at timestamptz,
  last_ok_at  timestamptz,
  last_count  int not null default 0,
  last_error  text check (last_error is null or char_length(last_error) <= 300)
);
alter table public.social_sync enable row level security;
create policy "Content viewers read sync status" on public.social_sync for select to authenticated using (public.has_any_perm('{content.view}'::text[]));
grant select on public.social_sync to authenticated;

-- ================================================================ messages

create table public.message_threads (
  id                     uuid primary key default gen_random_uuid(),
  member_id              uuid not null unique references public.profiles (id) on delete cascade,
  status                 text not null default 'open' check (status in ('open', 'done')),
  last_message_at        timestamptz not null default now(),
  last_member_message_at timestamptz,
  member_read_at         timestamptz,
  team_read_at           timestamptz,
  created_at             timestamptz not null default now()
);
create index message_threads_last_idx on public.message_threads (last_message_at desc);

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.message_threads (id) on delete cascade,
  author     uuid references auth.users (id) on delete set null,
  from_team  boolean not null default false,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_thread_idx on public.messages (thread_id, created_at);

alter table public.message_threads enable row level security;
alter table public.messages enable row level security;
create policy "Members see their thread; Messages viewers see all" on public.message_threads
  for select to authenticated using (member_id = auth.uid() or public.has_any_perm('{messages.view}'::text[]));
create policy "Members see their messages; Messages viewers see all" on public.messages
  for select to authenticated using (
    exists (select 1 from public.message_threads t where t.id = thread_id and t.member_id = auth.uid())
    or public.has_any_perm('{messages.view}'::text[]));
grant select on public.message_threads, public.messages to authenticated;
-- Writes go through the functions below only.

-- A member writes to the team. Returns whether the inbox should get an email
-- (a new conversation, or the member's first message after more than an hour).
create or replace function public.send_message(p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  body text := trim(coalesce(p_body, ''));
  t public.message_threads;
  is_new boolean := false;
  alert boolean;
begin
  if me is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if exists (select 1 from public.admin_users where user_id = me) then raise exception 'admin_account' using errcode = '42501'; end if;
  if char_length(body) not between 1 and 2000 then raise exception 'bad_message' using errcode = '22023'; end if;
  select * into t from public.message_threads where member_id = me for update;
  if t.id is null then
    insert into public.message_threads (member_id) values (me) returning * into t;
    is_new := true;
  end if;
  if (select count(*) from public.messages where thread_id = t.id and not from_team and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'too_many_messages' using errcode = '22023';
  end if;
  alert := is_new or t.last_member_message_at is null or t.last_member_message_at < now() - interval '1 hour' or t.status = 'done';
  insert into public.messages (thread_id, author, from_team, body) values (t.id, me, false, body);
  update public.message_threads
    set last_message_at = now(), last_member_message_at = now(), member_read_at = now(), status = 'open'
    where id = t.id;
  return jsonb_build_object('thread_id', t.id, 'alert', alert, 'new', is_new);
end $$;

-- The team replies. The member hears about it in their notifications bell.
create or replace function public.team_send_message(p_thread uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  body text := trim(coalesce(p_body, ''));
  who uuid;
begin
  if not public.has_any_perm('{messages.manage}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  if char_length(body) not between 1 and 2000 then raise exception 'bad_message' using errcode = '22023'; end if;
  select member_id into who from public.message_threads where id = p_thread for update;
  if who is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into public.messages (thread_id, author, from_team, body) values (p_thread, me, true, body);
  update public.message_threads set last_message_at = now(), team_read_at = now() where id = p_thread;
  perform public.notify(who, 'New message from VentureWeavers: ' || left(body, 120), '/messages');
end $$;

create or replace function public.mark_my_messages_read() returns void
language sql security definer set search_path = '' as $$
  update public.message_threads set member_read_at = now() where member_id = auth.uid();
$$;

create or replace function public.team_mark_thread_read(p_thread uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_any_perm('{messages.view}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  update public.message_threads set team_read_at = now() where id = p_thread;
end $$;

create or replace function public.team_set_thread_status(p_thread uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_any_perm('{messages.manage}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_status not in ('open', 'done') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.message_threads set status = p_status where id = p_thread;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
end $$;

revoke all on function public.send_message(text), public.team_send_message(uuid, text), public.mark_my_messages_read(),
  public.team_mark_thread_read(uuid), public.team_set_thread_status(uuid, text) from public;
grant execute on function public.send_message(text), public.team_send_message(uuid, text), public.mark_my_messages_read(),
  public.team_mark_thread_read(uuid), public.team_set_thread_status(uuid, text) to authenticated;

-- Live updates (Supabase Realtime respects the policies above).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ================================================================ admin access: a Messages area

create or replace function public.admin_perm_list() returns text[] language sql immutable set search_path = '' as $$
  select array[
    'overview.view',
    'contacts.view', 'contacts.manage',
    'requests.view', 'requests.manage',
    'messages.view', 'messages.manage',
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
