-- Phase 14: admin team and access levels. Plan: docs/phase-14-plan.md.
-- Super admins (Ahmed and Karim) can do everything. Team members get ticked areas, each view or manage
-- ("manage" includes "view"). Keep the permission list in step with src/lib/auth/permissions.ts.
-- Every existing admin check (policies, functions, the payments view) is rewritten from the area map
-- below; the migration fails if any admin check is left unmapped.

-- ---------------------------------------------------------------- team members

alter table public.admin_users
  add column is_super    boolean not null default false,
  add column permissions text[] not null default '{}',
  add column paused_at   timestamptz,
  add column added_by    uuid references auth.users (id) on delete set null;

-- Today's admins are the two partners: they become the super admins.
update public.admin_users set is_super = true;

-- Super admins are fixed: nobody can be made a super admin from the app.
create or replace function public.admin_users_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_super and (tg_op = 'INSERT' or not old.is_super) and auth.uid() is not null then
    raise exception 'super_admins_fixed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger admin_users_guard before insert or update on public.admin_users
  for each row execute function public.admin_users_guard();

create or replace function public.admin_perm_list() returns text[] language sql immutable set search_path = '' as $$
  select array[
    'overview.view',
    'contacts.view', 'contacts.manage',
    'requests.view', 'requests.manage',
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

-- Any active admin (super or team, not paused).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid() and paused_at is null);
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid() and paused_at is null and is_super);
$$;

create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid() and a.paused_at is null
      and (a.is_super or p = any (a.permissions)
           or (p like '%.view' and (left(p, -5) || '.manage') = any (a.permissions))));
$$;

create or replace function public.has_any_perm(ps text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from unnest(ps) p where public.has_perm(p));
$$;

-- What the signed-in admin may do (for the app's menu and checks).
create or replace function public.my_admin_access() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('is_super', is_super, 'permissions', permissions)
  from public.admin_users where user_id = auth.uid() and paused_at is null;
$$;

revoke all on function public.is_super_admin(), public.has_perm(text), public.has_any_perm(text[]), public.my_admin_access(), public.admin_perm_list() from public;
grant execute on function public.is_super_admin(), public.has_perm(text), public.has_any_perm(text[]), public.my_admin_access(), public.admin_perm_list() to anon, authenticated, service_role;

-- ---------------------------------------------------------------- rewrite admin checks by area

create temp table area_map (kind text, name text, view_perms text[], manage_perms text[], super_only boolean default false, keep boolean default false);

insert into area_map (kind, name, view_perms, manage_perms) values
  -- TVS
  ('table', 'public.applications',    '{tvs.view}', '{tvs.manage}'),
  ('table', 'public.program_interest','{tvs.view}', '{tvs.manage}'),
  ('table', 'public.programs',        '{tvs.view,classroom.view,payments.view}', '{tvs.manage}'),
  ('table', 'public.cohorts',         '{tvs.view,classroom.view,payments.view}', '{tvs.manage}'),
  ('table', 'public.enrolments',      '{tvs.view,classroom.view,payments.view}', '{tvs.manage}'),
  ('table', 'public.cohort_links',    '{tvs.view,classroom.view}', '{tvs.manage,classroom.manage}'),
  -- classroom
  ('table', 'public.modules',         '{classroom.view}', '{classroom.manage}'),
  ('table', 'public.module_steps',    '{classroom.view}', '{classroom.manage}'),
  ('table', 'public.assignments',     '{classroom.view}', '{classroom.manage}'),
  ('table', 'public.class_sessions',  '{classroom.view}', '{classroom.manage}'),
  ('table', 'public.cohort_files',    '{classroom.view}', '{classroom.manage}'),
  ('table', 'public.cohort_posts',    '{classroom.view}', '{classroom.manage}'),
  ('table', 'public.step_progress',   '{classroom.view}', '{classroom.manage}'),
  ('table', 'public.submissions',     '{classroom.view}', '{classroom.manage}'),
  -- Outloud events, bookings, tickets (masterclasses are events managed from TVS).
  -- Door staff read nothing directly: admin_check_in() returns what the door needs.
  ('table', 'public.events',          '{events.view,tvs.view,live.manage,payments.view}', '{events.manage,tvs.manage}'),
  ('table', 'public.event_links',     '{events.view,tvs.view}', '{events.manage,tvs.manage}'),
  ('table', 'public.bookings',        '{events.view,tvs.view,payments.view}', '{events.manage,payments.manage}'),
  ('table', 'public.tickets',         '{events.view,tvs.view}', '{events.manage}'),
  -- Live mode
  ('table', 'public.live_sessions',   '{live.manage,events.view}', '{live.manage}'),
  ('table', 'public.live_questions',  '{live.manage}', '{live.manage}'),
  ('table', 'public.live_votes',      '{live.manage}', '{live.manage}'),
  ('table', 'public.live_polls',      '{live.manage}', '{live.manage}'),
  ('table', 'public.live_poll_options','{live.manage}', '{live.manage}'),
  ('table', 'public.live_poll_votes', '{live.manage}', '{live.manage}'),
  -- content, blog, topics, feed and publishing
  ('table', 'public.content_items',   '{content.view}', '{content.manage}'),
  ('table', 'public.blog_posts',      '{content.view}', '{content.manage}'),
  ('table', 'public.topic_suggestions','{content.view,events.view}', '{content.manage}'),
  ('table', 'public.posts',           '{publishing.manage,content.view}', '{publishing.manage}'),
  ('table', 'public.publish_log',     '{publishing.manage}', '{publishing.manage}'),
  -- Library
  ('table', 'public.library_resources','{library.view}', '{library.manage}'),
  -- Contacts and people
  ('table', 'public.contacts',        '{contacts.view}', '{contacts.manage}'),
  ('table', 'public.contact_notes',   '{contacts.view}', '{contacts.manage}'),
  ('table', 'public.member_suspensions','{contacts.view}', '{contacts.manage}'),
  ('table', 'public.profiles',        '{contacts.view,requests.view,payments.view,tvs.view,classroom.view,events.view,live.manage,quidquo.view}', '{contacts.manage}'),
  -- Requests and BRICKR
  ('table', 'public.requests',        '{requests.view,contacts.view}', '{requests.manage}'),
  ('table', 'public.request_notes',   '{requests.view}', '{requests.manage}'),
  ('table', 'public.services',        '{brickr.view,requests.view}', '{brickr.manage}'),
  -- Payments
  ('table', 'public.payment_requests','{payments.view}', '{payments.manage}'),
  ('table', 'public.payments',        '{payments.view}', '{payments.manage}'),
  -- QuidQuo
  ('table', 'public.qq_stages',       '{quidquo.view}', '{quidquo.manage}'),
  ('table', 'public.qq_log',          '{quidquo.view}', '{quidquo.manage}'),
  ('table', 'public.waitlist',        '{quidquo.view}', '{quidquo.manage}'),
  -- uploads: anyone who manages content of some kind
  ('table', 'storage.objects',        '{content.manage,tvs.manage,events.manage,brickr.manage,publishing.manage,library.manage,classroom.manage}',
                                      '{content.manage,tvs.manage,events.manage,brickr.manage,publishing.manage,library.manage,classroom.manage}');
-- Super admins only.
insert into area_map (kind, name, super_only) values ('table', 'public.audit_log', true);
-- Settings: every admin may read (bank details for payment emails, Calendly link); only super admins edit.
insert into area_map (kind, name, view_perms, manage_perms, keep) values ('table', 'public.site_settings', null, null, true);
-- Profiles: only super admins delete.
insert into area_map (kind, name, super_only) values ('policy', 'Admins delete profiles', true);

insert into area_map (kind, name, view_perms, manage_perms) values
  ('function', 'admin_cancel_booking',     null, '{events.manage,payments.manage}'),
  ('function', 'admin_cancel_enrolment',   null, '{tvs.manage,payments.manage}'),
  ('function', 'admin_check_in',           null, '{checkin.manage,events.manage}'),
  ('function', 'admin_confirm_enrolment',  null, '{tvs.manage,payments.manage}'),
  ('function', 'admin_live_end',           null, '{live.manage}'),
  ('function', 'admin_live_moment',        null, '{live.manage}'),
  ('function', 'admin_live_open',          null, '{live.manage}'),
  ('function', 'admin_live_pick',          null, '{live.manage}'),
  ('function', 'admin_live_poll_open',     null, '{live.manage}'),
  ('function', 'admin_log_password_reset', null, '{contacts.manage}'),
  ('function', 'admin_set_suspension',     null, '{contacts.manage}'),
  ('function', 'admin_update_member',      null, '{contacts.manage}'),
  ('function', 'admin_mark_paid',          null, '{payments.manage,events.manage}'),
  ('function', 'admin_offer_seat',         null, '{tvs.manage}'),
  ('function', 'admin_refund_enrolment',   null, '{payments.manage}'),
  ('function', 'admin_reopen_submission',  null, '{classroom.manage}'),
  ('function', 'admin_review_submission',  null, '{classroom.manage}'),
  ('function', 'admin_request_status',     null, '{payments.manage}'),
  ('function', 'admin_resource_targets',   null, '{library.view}'),
  ('function', 'can_see_cohort',           null, '{classroom.view,tvs.view}'),
  ('function', 'cohort_posts_before',      null, '{classroom.view}'),
  ('function', 'event_seats_left',         null, '{events.view,tvs.view}'),
  ('function', 'open_resource',            null, '{library.view}'),
  ('view',     'public.payments_ledger',   '{payments.view}', null);

create function pg_temp.perm_expr(ps text[]) returns text language sql immutable as $$
  select format('public.has_any_perm(%L::text[])', ps::text);
$$;

do $$
declare
  r record;
  m area_map;
  pm area_map;
  v_expr text;
  m_expr text;
  def text;
  rx constant text := '(public\.)?is_admin\(\)';
begin
  -- Policies
  for r in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where coalesce(qual, '') || coalesce(with_check, '') ~ rx
  loop
    select * into pm from area_map where kind = 'policy' and name = r.policyname;
    select * into m from area_map where kind = 'table' and name = r.schemaname || '.' || r.tablename;
    if pm.name is not null then m := pm; end if;
    if m.name is null then raise exception 'Unmapped admin policy: %.% "%"', r.schemaname, r.tablename, r.policyname; end if;
    if m.keep and r.cmd = 'SELECT' then continue; end if;
    if m.super_only or m.keep then
      v_expr := 'public.is_super_admin()';
      m_expr := 'public.is_super_admin()';
    else
      v_expr := pg_temp.perm_expr(m.view_perms);
      m_expr := pg_temp.perm_expr(m.manage_perms);
    end if;
    if r.cmd = 'SELECT' then
      execute format('alter policy %I on %I.%I using (%s)', r.policyname, r.schemaname, r.tablename, regexp_replace(r.qual, rx, v_expr, 'g'));
    elsif r.cmd = 'INSERT' then
      execute format('alter policy %I on %I.%I with check (%s)', r.policyname, r.schemaname, r.tablename, regexp_replace(r.with_check, rx, m_expr, 'g'));
    else
      if r.qual is not null then
        execute format('alter policy %I on %I.%I using (%s)', r.policyname, r.schemaname, r.tablename, regexp_replace(r.qual, rx, m_expr, 'g'));
      end if;
      if r.with_check is not null then
        execute format('alter policy %I on %I.%I with check (%s)', r.policyname, r.schemaname, r.tablename, regexp_replace(r.with_check, rx, m_expr, 'g'));
      end if;
      -- An "all" policy also gave admins read access: keep that for people with view rights.
      if r.cmd = 'ALL' and not (m.super_only or m.keep) and r.qual is not null then
        execute format('create policy %I on %I.%I for select to authenticated using (%s)',
          left(r.policyname || ' (view)', 63), r.schemaname, r.tablename, regexp_replace(r.qual, rx, v_expr, 'g'));
      end if;
    end if;
  end loop;

  -- Functions
  for r in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc ~ rx
      and p.proname not in ('is_admin', 'is_super_admin', 'has_perm', 'has_any_perm', 'my_admin_access')
  loop
    select * into m from area_map where kind = 'function' and name = r.proname;
    if m.name is null then raise exception 'Unmapped admin function: %', r.proname; end if;
    def := pg_get_functiondef(r.oid);
    execute regexp_replace(def, rx, pg_temp.perm_expr(m.manage_perms), 'g');
  end loop;

  -- The payments view
  def := pg_get_viewdef('public.payments_ledger'::regclass, true);
  select * into m from area_map where kind = 'view' and name = 'public.payments_ledger';
  execute 'create or replace view public.payments_ledger with (security_invoker = true) as ' || regexp_replace(def, rx, pg_temp.perm_expr(m.view_perms), 'g');

  -- Nothing may be left on the old "any admin" rule except settings reads.
  if exists (
    select 1 from pg_policies
    where coalesce(qual, '') || coalesce(with_check, '') ~ rx
      and not (schemaname = 'public' and tablename = 'site_settings' and cmd = 'SELECT')
  ) then
    raise exception 'An admin policy was not rewritten';
  end if;
end $$;

-- ---------------------------------------------------------------- managing the team (super admins only)

create or replace function public.admin_team_add(p_user uuid, p_username text, p_display text, p_perms text[])
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); perms text[];
begin
  if not public.is_super_admin() then raise exception 'not_super' using errcode = '42501'; end if;
  if p_username !~ '^[a-z0-9._-]{3,32}$' then raise exception 'bad_username' using errcode = '22023'; end if;
  if coalesce(char_length(trim(p_display)), 0) not between 2 and 80 then raise exception 'bad_name' using errcode = '22023'; end if;
  if exists (select 1 from public.admin_users where username = p_username) then raise exception 'username_taken' using errcode = '23505'; end if;
  if exists (select 1 from public.admin_users where user_id = p_user) then raise exception 'already_admin' using errcode = '23505'; end if;
  perms := array(select distinct x from unnest(p_perms) x where x = any (public.admin_perm_list()) order by 1);
  insert into public.admin_users (user_id, username, display_name, permissions, added_by)
  values (p_user, p_username, trim(p_display), perms, me);
  insert into public.audit_log (actor, action, entity, entity_id, after)
  values (me, 'team.add', 'admin_users', p_user::text, jsonb_build_object('username', p_username, 'permissions', perms));
end $$;

create or replace function public.admin_team_update(p_user uuid, p_display text, p_perms text[])
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); old text[]; perms text[];
begin
  if not public.is_super_admin() then raise exception 'not_super' using errcode = '42501'; end if;
  select permissions into old from public.admin_users where user_id = p_user and not is_super;
  if not found then raise exception 'not_team_member' using errcode = 'P0002'; end if;
  if coalesce(char_length(trim(p_display)), 0) not between 2 and 80 then raise exception 'bad_name' using errcode = '22023'; end if;
  perms := array(select distinct x from unnest(p_perms) x where x = any (public.admin_perm_list()) order by 1);
  update public.admin_users set display_name = trim(p_display), permissions = perms where user_id = p_user;
  insert into public.audit_log (actor, action, entity, entity_id, before, after)
  values (me, 'team.update', 'admin_users', p_user::text, jsonb_build_object('permissions', old), jsonb_build_object('permissions', perms));
end $$;

create or replace function public.admin_team_pause(p_user uuid, p_pause boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not public.is_super_admin() then raise exception 'not_super' using errcode = '42501'; end if;
  update public.admin_users set paused_at = case when p_pause then now() end where user_id = p_user and not is_super;
  if not found then raise exception 'not_team_member' using errcode = 'P0002'; end if;
  if p_pause then
    begin
      delete from auth.sessions where user_id = p_user;
    exception when others then null;
    end;
  end if;
  insert into public.audit_log (actor, action, entity, entity_id) values (me, case when p_pause then 'team.pause' else 'team.resume' end, 'admin_users', p_user::text);
end $$;

create or replace function public.admin_team_remove(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not public.is_super_admin() then raise exception 'not_super' using errcode = '42501'; end if;
  delete from public.admin_users where user_id = p_user and not is_super;
  if not found then raise exception 'not_team_member' using errcode = 'P0002'; end if;
  begin
    delete from auth.sessions where user_id = p_user;
  exception when others then null;
  end;
  insert into public.audit_log (actor, action, entity, entity_id) values (me, 'team.remove', 'admin_users', p_user::text);
end $$;

revoke all on function public.admin_team_add(uuid, text, text, text[]), public.admin_team_update(uuid, text, text[]),
  public.admin_team_pause(uuid, boolean), public.admin_team_remove(uuid) from public;
grant execute on function public.admin_team_add(uuid, text, text, text[]), public.admin_team_update(uuid, text, text[]),
  public.admin_team_pause(uuid, boolean), public.admin_team_remove(uuid) to authenticated;
