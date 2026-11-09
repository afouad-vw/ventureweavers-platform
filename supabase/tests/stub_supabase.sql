-- Minimal stand-in for Supabase's auth schema and roles, so migrations and access tests
-- can run against plain Postgres (CI or local) without the Supabase CLI.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema extensions;
create schema auth;
grant usage on schema public, extensions, auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'
);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
-- Mirrors the project setting "Automatically expose new tables: off": no default table grants.
revoke create on schema public from public;
