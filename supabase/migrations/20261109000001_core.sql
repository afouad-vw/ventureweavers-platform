-- Phase 2 core: profiles, admin accounts, admin sessions, sign-in attempts, audit log.
-- Access rules: docs/phase-2-plan.md. Every table has Row Level Security on.

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------- helpers

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- admin accounts
-- Rows are added by hand in the SQL editor (never from the app or the browser).

create table public.admin_users (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  username     extensions.citext not null unique check (username ~ '^[a-z0-9._-]{3,32}$'),
  display_name text not null,
  created_at   timestamptz not null default now()
);

-- True only for a listed admin whose session passed 2-step verification.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.admin_users a where a.user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------- member profiles

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text check (char_length(full_name) <= 120),
  avatar_url         text,
  phone              text check (char_length(phone) <= 32),
  role               text check (char_length(role) <= 60),
  stage              text check (char_length(stage) <= 60),
  goals              text[] not null default '{}',
  interests          text[] not null default '{}',
  consent_whatsapp   boolean not null default false,
  consent_push       boolean not null default false,
  consent_newsletter boolean not null default false,
  onboarded_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create a profile for every new account, using the name and photo from Google or LinkedIn when present.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "Members read their own profile; admins read all"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "Members update their own profile; admins update any"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy "Admins delete profiles"
  on public.profiles for delete to authenticated
  using (public.is_admin());

-- Tables are not exposed by default in this project; grant exactly what the policies need.
revoke all on public.profiles from anon, authenticated;
grant select, update, delete on public.profiles to authenticated;

-- ---------------------------------------------------------------- admin sessions (idle timeout)

create table public.admin_sessions (
  session_id   uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at   timestamptz
);
create index admin_sessions_user_idx on public.admin_sessions (user_id);

-- ---------------------------------------------------------------- sign-in attempts (lockout)

create table public.auth_attempts (
  id       bigint generated always as identity primary key,
  scope    text not null check (scope in ('admin', 'member')),
  username extensions.citext,
  ip       inet,
  ok       boolean not null,
  at       timestamptz not null default now()
);
create index auth_attempts_username_idx on public.auth_attempts (username, at desc);
create index auth_attempts_ip_idx on public.auth_attempts (ip, at desc);

-- ---------------------------------------------------------------- audit log (append-only)

create table public.audit_log (
  id        bigint generated always as identity primary key,
  actor     uuid references auth.users (id) on delete set null,
  action    text not null,
  entity    text not null,
  entity_id text,
  before    jsonb,
  after     jsonb,
  ip        inet,
  at        timestamptz not null default now()
);
create index audit_log_at_idx on public.audit_log (at desc);

create or replace function public.audit_log_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_log is append-only';
end $$;

create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.audit_log_append_only();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public.audit_log_append_only();

-- ---------------------------------------------------------------- lock down server-only tables

alter table public.admin_users    enable row level security;
alter table public.admin_sessions enable row level security;
alter table public.auth_attempts  enable row level security;
alter table public.audit_log      enable row level security;

create policy "Admins read the audit log"
  on public.audit_log for select to authenticated
  using (public.is_admin());

revoke all on public.admin_users, public.admin_sessions, public.auth_attempts, public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

-- The server (service role) works with every table; the audit log stays append-only through its triggers.
grant all on public.profiles, public.admin_users, public.admin_sessions, public.auth_attempts to service_role;
grant select, insert on public.audit_log to service_role;
grant usage, select on all sequences in schema public to service_role;
