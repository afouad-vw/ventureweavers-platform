-- 2026-11-17 (approved): new Ecosystem Role list, business Stage (ventures only), "Full episodes" placeholder removed.

-- ================================================================ Ecosystem Roles: the new list

alter table public.profiles drop constraint profiles_roles_check;

create or replace function public.role_list() returns text[] language sql immutable set search_path = '' as $$
  select array['Founder', 'Angel Investor', 'Institutional investor', 'Corporate', 'Institutional Enabler', 'Venture Studio', 'Expert', 'Mentor', 'Exploring the ecosystem']::text[] $$;

-- Old choices move to the closest new one (no repeats; the trigger keeps "role" as the first).
update public.profiles p set roles = coalesce((
  select array_agg(n order by first_at) from (
    select n, min(o) as first_at from unnest(p.roles) with ordinality as x(r, o)
    cross join lateral (select case x.r
      when 'Investor or angel' then 'Angel Investor'
      when 'Corporate innovator' then 'Corporate'
      when 'Career professional' then 'Exploring the ecosystem'
      when 'Expert or mentor' then 'Expert'
      when 'Exploring my first venture' then 'Exploring the ecosystem'
      else x.r end as n) m
    where n = any (public.role_list())
    group by n
  ) d), '{}')
where cardinality(roles) > 0;
update public.profiles set role = null where role is not null and cardinality(roles) = 0;

alter table public.profiles add constraint profiles_roles_check check (public.is_roles(roles));

-- ================================================================ business Stage (ventures only)

create or replace function public.stage_list() returns text[] language sql immutable set search_path = '' as $$
  select array['Idea', 'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+']::text[] $$;
revoke all on function public.stage_list() from public;
grant execute on function public.stage_list() to anon, authenticated, service_role;

alter table public.member_businesses add column stage text
  check (stage is null or (stage = any (public.stage_list()) and type = 'Venture'));

-- One member's businesses as JSON, in order (used for the audit log and the functions below).
create or replace function public.businesses_json(p_member uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'type', type, 'stage', stage, 'website', website, 'member_role', member_role, 'linkedin', linkedin) order by position), '[]'::jsonb)
  from public.member_businesses where member_id = p_member $$;
revoke all on function public.businesses_json(uuid) from public, anon, authenticated;

create or replace function public.write_businesses(p_member uuid, p_list jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare i int := 0; x jsonb;
begin
  if p_list is null or jsonb_typeof(p_list) <> 'array' then raise exception 'bad_businesses' using errcode = '22023'; end if;
  if jsonb_array_length(p_list) > 10 then raise exception 'too_many_businesses' using errcode = '22023'; end if;
  delete from public.member_businesses where member_id = p_member;
  for x in select value from jsonb_array_elements(p_list) loop
    insert into public.member_businesses (member_id, position, name, type, stage, website, member_role, linkedin)
    values (p_member, i, trim(x->>'name'), nullif(x->>'type', ''),
            case when x->>'type' = 'Venture' then nullif(x->>'stage', '') end,
            nullif(trim(coalesce(x->>'website', '')), ''),
            nullif(trim(coalesce(x->>'member_role', '')), ''), nullif(trim(coalesce(x->>'linkedin', '')), ''));
    i := i + 1;
  end loop;
  return public.businesses_json(p_member);
end $$;
revoke all on function public.write_businesses(uuid, jsonb) from public, anon, authenticated;

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
  old_biz := public.businesses_json(p_member);

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

-- ================================================================ series: no "Full episodes" placeholder

update public.content_items set series = 'Open Floor' where series = 'Full episodes';
delete from public.content_series where name = 'Full episodes';
