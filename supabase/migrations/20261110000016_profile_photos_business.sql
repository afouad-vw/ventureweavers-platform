-- Phase 14 (part 2): member profile photos, business details, role-based TVS application answers.
-- Plan: docs/phase-14-plan.md.

-- ---------------------------------------------------------------- profile photos

-- Public bucket; the server writes each member's own folder after checking the file (no browser writes).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Photos are https addresses only (our bucket, or the Google/LinkedIn photo from sign-up).
alter table public.profiles add constraint profiles_avatar_url_check
  check (avatar_url is null or (char_length(avatar_url) <= 600 and avatar_url ~ '^https://[^\s<>"]+$')) not valid;

-- ---------------------------------------------------------------- business details (optional)

alter table public.profiles
  add column business_name    text check (business_name is null or char_length(business_name) between 1 and 120),
  add column business_website text check (business_website is null or (char_length(business_website) <= 200 and business_website ~ '^https?://[^\s<>"]+\.[^\s<>"]+$')),
  add column business_type    text check (business_type is null or business_type in ('Venture', 'Corporate', 'Capital', 'Government & non-profit', 'Education', 'Other'));

-- Partners can edit these too (Contacts › Edit details). Replaces the Phase 13 version.
drop function if exists public.admin_update_member(uuid, text, text, text, text, text, text[], text[]);
create or replace function public.admin_update_member(
  p_member uuid, p_full_name text, p_phone text, p_linkedin text, p_country text, p_role text,
  p_goals text[], p_contact_prefs text[],
  p_business_name text default null, p_business_website text default null, p_business_type text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  old jsonb;
  new jsonb;
begin
  if not public.has_any_perm('{contacts.manage}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  if exists (select 1 from public.admin_users where user_id = p_member) then raise exception 'admin_account' using errcode = '42501'; end if;
  select jsonb_build_object('full_name', full_name, 'phone', phone, 'linkedin', linkedin, 'country', country, 'role', role, 'goals', goals, 'contact_prefs', contact_prefs,
                            'business_name', business_name, 'business_website', business_website, 'business_type', business_type)
    into old from public.profiles where id = p_member;
  if old is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if coalesce(char_length(trim(p_full_name)), 0) < 2 then raise exception 'bad_name' using errcode = '22023'; end if;
  if p_phone is null or p_phone !~ '^\+[0-9]{1,4} [0-9]{4,15}$' then raise exception 'bad_phone' using errcode = '22023'; end if;
  if not (p_goals <@ array['Education', 'Services', 'Content', 'QuidQuo']::text[]) or cardinality(p_goals) = 0 then raise exception 'bad_interests' using errcode = '22023'; end if;
  if cardinality(p_contact_prefs) = 0 then raise exception 'bad_contact' using errcode = '22023'; end if;

  update public.profiles set
    full_name = left(trim(p_full_name), 120),
    phone = p_phone,
    linkedin = nullif(p_linkedin, ''),
    country = p_country,
    role = p_role,
    goals = p_goals,
    contact_prefs = p_contact_prefs,
    consent_whatsapp = 'WhatsApp' = any (p_contact_prefs),
    business_name = nullif(trim(coalesce(p_business_name, '')), ''),
    business_website = nullif(trim(coalesce(p_business_website, '')), ''),
    business_type = nullif(p_business_type, '')
  where id = p_member;

  select jsonb_build_object('full_name', full_name, 'phone', phone, 'linkedin', linkedin, 'country', country, 'role', role, 'goals', goals, 'contact_prefs', contact_prefs,
                            'business_name', business_name, 'business_website', business_website, 'business_type', business_type)
    into new from public.profiles where id = p_member;
  if new is distinct from old then
    insert into public.audit_log (actor, action, entity, entity_id, before, after)
    values (me, 'member.update', 'profile', p_member::text, old, new);
    perform public.notify(p_member, 'Your profile details were updated by the VentureWeavers team.', '/my-space?tab=profile');
  end if;
end $$;
revoke all on function public.admin_update_member(uuid, text, text, text, text, text, text[], text[], text, text, text) from public;
grant execute on function public.admin_update_member(uuid, text, text, text, text, text, text[], text[], text, text, text) to authenticated;

-- ---------------------------------------------------------------- TVS applications: questions by role

-- answers: [{ "q": "question", "a": "answer" }], at most 12, answers up to 1,000 characters.
create or replace function public.is_answers(v jsonb) returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(v) = 'array' and jsonb_array_length(v) <= 12 and not exists (
    select 1 from jsonb_array_elements(v) x
    where jsonb_typeof(x) <> 'object'
       or char_length(coalesce(x->>'q', '')) not between 1 and 160
       or char_length(coalesce(x->>'a', '')) > 1000) $$;
revoke all on function public.is_answers(jsonb) from public;
grant execute on function public.is_answers(jsonb) to anon, authenticated, service_role;

alter table public.applications add column answers jsonb not null default '[]' check (public.is_answers(answers));
-- "What are you building" now lives in the role's questions; the old column stays for earlier applications.
alter table public.applications drop constraint if exists applications_building_check;
alter table public.applications add constraint applications_building_check check (char_length(building) <= 1000);
grant insert (answers) on public.applications to authenticated;
