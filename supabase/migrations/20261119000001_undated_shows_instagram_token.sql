-- 1) Shows can be saved without a date while they are Draft or Coming soon (members see TBA).
--    Publishing still needs a date. Private sessions never need one.
alter table public.events drop constraint if exists dated_unless_private;
alter table public.events add constraint dated_unless_private
  check (type = 'private_session' or starts_at is not null or status <> 'published');

-- 2) Integration tokens (Instagram for now). Server only: no policies and no grants, so only the
--    service role (used by server actions after an admin check, and by the daily cron) can read or write.
create table public.integration_tokens (
  provider     text primary key check (provider in ('instagram')),
  token        text not null check (char_length(token) between 20 and 1000),
  expires_at   timestamptz,
  refreshed_at timestamptz not null default now(),
  last_error   text check (last_error is null or char_length(last_error) <= 300),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users (id) on delete set null
);
alter table public.integration_tokens enable row level security;
revoke all on public.integration_tokens from anon, authenticated;
grant select, insert, update, delete on public.integration_tokens to service_role;
