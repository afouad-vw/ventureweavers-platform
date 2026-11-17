-- Approved 2026-11-17: businesses members list in their profiles join the CRM automatically (matched by
-- website, then by name; the member is linked with their role). Removing a business from a profile removes
-- only that automatic link. Businesses get "Relationship with VW" tags. The team can start a conversation.

-- ================================================================ relationship with VW

create or replace function public.relationship_list() returns text[] language sql immutable set search_path = '' as $$
  select array['Partner', 'Client', 'Service Provider', 'Sponsor', 'Investor', 'Portfolio', 'Prospect', 'Community']::text[];
$$;

alter table public.companies add column relationships text[] not null default '{}'
  check (relationships <@ public.relationship_list() and cardinality(relationships) <= 8);

-- Where a link came from: added by the team, or from the member's own profile.
alter table public.company_people add column source text not null default 'team' check (source in ('team', 'profile'));

-- ================================================================ matching

-- "https://www.NilePay.com/about" -> "nilepay.com"; empty for social and link pages, which say nothing about the business.
create or replace function public.crm_domain(p_url text) returns text language sql immutable set search_path = '' as $$
  select case when d is null or d = '' or d in ('linkedin.com', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'tiktok.com',
    'youtube.com', 'linktr.ee', 'google.com', 'sites.google.com', 'medium.com', 'notion.site', 'gmail.com', 'wa.me') then '' else d end
  from (select regexp_replace(lower(split_part(regexp_replace(coalesce(p_url, ''), '^[a-zA-Z]+://', ''), '/', 1)), '^www\.', '') as d) x;
$$;

-- The same business written differently: "Nile Pay LLC" and "nile-pay" -> "nile pay".
create or replace function public.crm_name_key(p_name text) returns text language sql immutable set search_path = '' as $$
  select trim(regexp_replace(
    regexp_replace(' ' || regexp_replace(lower(coalesce(p_name, '')), '[^[:alnum:]]+', ' ', 'g') || ' ',
      ' (llc|ltd|inc|co|company|the|sae|fz|fze) ', ' ', 'g'),
    '\s+', ' ', 'g'));
$$;

create or replace function public.crm_find_company(p_name text, p_website text) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select id from public.companies where public.crm_domain(p_website) <> '' and public.crm_domain(website) = public.crm_domain(p_website)
      order by status = 'active' desc, created_at limit 1),
    (select id from public.companies where public.crm_name_key(p_name) <> '' and public.crm_name_key(name) = public.crm_name_key(p_name)
      order by status = 'active' desc, created_at limit 1));
$$;

-- Put one profile business in the CRM: match or create the business (filling only empty details on a match),
-- then link the member with their role. Links the team added keep their own role unless it was empty.
create or replace function public.crm_sync_member_business(p_member uuid, p_name text, p_type text, p_stage text, p_website text, p_linkedin text, p_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  if p_member is null or coalesce(trim(p_name), '') = '' then return null; end if;
  if exists (select 1 from public.admin_users where user_id = p_member) then return null; end if;
  perform pg_advisory_xact_lock(hashtext('crm:' || public.crm_name_key(p_name)));
  cid := public.crm_find_company(p_name, p_website);
  if cid is null then
    insert into public.companies (name, type, stage, website, linkedin)
    values (left(trim(p_name), 120), p_type, case when p_type = 'Venture' then p_stage end, p_website, p_linkedin)
    returning id into cid;
  else
    update public.companies c set
      type     = coalesce(c.type, p_type),
      stage    = case when coalesce(c.type, p_type) = 'Venture' then coalesce(c.stage, case when p_type = 'Venture' then p_stage end) end,
      website  = coalesce(c.website, p_website),
      linkedin = coalesce(c.linkedin, p_linkedin)
    where c.id = cid and (c.type is null or c.website is null or c.linkedin is null or (c.stage is null and coalesce(c.type, p_type) = 'Venture' and p_type = 'Venture'));
  end if;
  insert into public.company_people (company_id, member_id, role, source) values (cid, p_member, p_role, 'profile')
  on conflict (company_id, member_id) where member_id is not null
  do update set role = case when public.company_people.source = 'profile' or public.company_people.role is null then excluded.role else public.company_people.role end;
  return cid;
end $$;
revoke all on function public.crm_sync_member_business(uuid, text, text, text, text, text, text), public.crm_find_company(text, text) from public, anon, authenticated;

create or replace function public.member_business_to_crm() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.crm_sync_member_business(new.member_id, new.name, new.type, new.stage, new.website, new.linkedin, new.member_role);
  return null;
end $$;
create trigger member_business_to_crm after insert or update on public.member_businesses
  for each row execute function public.member_business_to_crm();

-- After businesses leave a profile: drop automatic links that no longer match any business still on it.
create or replace function public.member_business_unlink() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.company_people cp
  where cp.member_id = old.member_id and cp.source = 'profile'
    and not exists (select 1 from public.member_businesses mb where mb.member_id = cp.member_id and public.crm_find_company(mb.name, mb.website) = cp.company_id);
  return null;
end $$;
create trigger member_business_unlink after delete on public.member_businesses
  for each row execute function public.member_business_unlink();

-- Everyone's current profile businesses, once.
select public.crm_sync_member_business(member_id, name, type, stage, website, linkedin, member_role)
from public.member_businesses order by created_at, position;

-- ================================================================ the team starts a conversation

create or replace function public.team_start_thread(p_member uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  body text := trim(coalesce(p_body, ''));
  tid uuid;
begin
  if not public.has_any_perm('{messages.manage}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  if char_length(body) not between 1 and 2000 then raise exception 'bad_message' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_member) or exists (select 1 from public.admin_users where user_id = p_member) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into public.message_threads (member_id) values (p_member) on conflict (member_id) do nothing;
  select id into tid from public.message_threads where member_id = p_member for update;
  insert into public.messages (thread_id, author, from_team, body) values (tid, me, true, body);
  update public.message_threads set last_message_at = now(), team_read_at = now() where id = tid;
  perform public.notify(p_member, 'New message from VentureWeavers: ' || left(body, 120), '/messages');
  return tid;
end $$;
revoke all on function public.team_start_thread(uuid, text) from public;
grant execute on function public.team_start_thread(uuid, text) to authenticated;
