-- Phase 13: partners edit member details, send password resets, and suspend accounts from Contacts.
-- Plan: docs/phase-13-plan.md. Admin accounts are never changed from here.

-- ---------------------------------------------------------------- suspensions

create table public.member_suspensions (
  member_id    uuid primary key references auth.users (id) on delete cascade,
  reason       text not null default '' check (char_length(reason) <= 500),
  suspended_by uuid references auth.users (id) on delete set null,
  suspended_at timestamptz not null default now()
);
alter table public.member_suspensions enable row level security;
create policy "Admins read suspensions" on public.member_suspensions for select to authenticated using (public.is_admin());
grant select on public.member_suspensions to authenticated;
grant all on public.member_suspensions to service_role;

-- Members can ask only about themselves (used to keep a suspended member out of the app at once).
create or replace function public.am_i_suspended() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.member_suspensions where member_id = auth.uid());
$$;
revoke all on function public.am_i_suspended() from public;
grant execute on function public.am_i_suspended() to authenticated;

-- ---------------------------------------------------------------- edit member details

create or replace function public.admin_update_member(
  p_member uuid, p_full_name text, p_phone text, p_linkedin text, p_country text, p_role text,
  p_goals text[], p_contact_prefs text[]
) returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  old jsonb;
  new jsonb;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if exists (select 1 from public.admin_users where user_id = p_member) then raise exception 'admin_account' using errcode = '42501'; end if;
  select jsonb_build_object('full_name', full_name, 'phone', phone, 'linkedin', linkedin, 'country', country, 'role', role, 'goals', goals, 'contact_prefs', contact_prefs)
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
    consent_whatsapp = 'WhatsApp' = any (p_contact_prefs)
  where id = p_member;

  select jsonb_build_object('full_name', full_name, 'phone', phone, 'linkedin', linkedin, 'country', country, 'role', role, 'goals', goals, 'contact_prefs', contact_prefs)
    into new from public.profiles where id = p_member;
  if new is distinct from old then
    insert into public.audit_log (actor, action, entity, entity_id, before, after)
    values (me, 'member.update', 'profile', p_member::text, old, new);
    perform public.notify(p_member, 'Your profile details were updated by the VentureWeavers team.', '/my-space?tab=profile');
  end if;
end $$;
revoke all on function public.admin_update_member(uuid, text, text, text, text, text, text[], text[]) from public;
grant execute on function public.admin_update_member(uuid, text, text, text, text, text, text[], text[]) to authenticated;

-- ---------------------------------------------------------------- suspend / lift

-- Records the suspension and signs the member out everywhere. The server also bans the account in Auth.
create or replace function public.admin_set_suspension(p_member uuid, p_suspend boolean, p_reason text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if exists (select 1 from public.admin_users where user_id = p_member) then raise exception 'admin_account' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = p_member) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_suspend then
    insert into public.member_suspensions (member_id, reason, suspended_by)
    values (p_member, left(coalesce(trim(p_reason), ''), 500), me)
    on conflict (member_id) do update set reason = excluded.reason, suspended_by = excluded.suspended_by, suspended_at = now();
    -- Sign them out everywhere (the Auth ban also stops new sign-ins and token refreshes).
    begin
      delete from auth.sessions where user_id = p_member;
    exception when others then null;
    end;
    insert into public.audit_log (actor, action, entity, entity_id, after)
    values (me, 'member.suspend', 'profile', p_member::text, jsonb_build_object('reason', left(coalesce(trim(p_reason), ''), 500)));
  else
    delete from public.member_suspensions where member_id = p_member;
    insert into public.audit_log (actor, action, entity, entity_id) values (me, 'member.unsuspend', 'profile', p_member::text);
  end if;
end $$;
revoke all on function public.admin_set_suspension(uuid, boolean, text) from public;
grant execute on function public.admin_set_suspension(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------- password reset log and limit

-- Called by the server before it emails a reset link: admin only, never for admin accounts, 3 per member per hour.
create or replace function public.admin_log_password_reset(p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if exists (select 1 from public.admin_users where user_id = p_member) then raise exception 'admin_account' using errcode = '42501'; end if;
  if (select count(*) from public.audit_log where action = 'member.password_reset' and entity_id = p_member::text and at > now() - interval '1 hour') >= 3 then
    raise exception 'too_many_resets' using errcode = '54000';
  end if;
  insert into public.audit_log (actor, action, entity, entity_id) values (me, 'member.password_reset', 'profile', p_member::text);
end $$;
revoke all on function public.admin_log_password_reset(uuid) from public;
grant execute on function public.admin_log_password_reset(uuid) to authenticated;
