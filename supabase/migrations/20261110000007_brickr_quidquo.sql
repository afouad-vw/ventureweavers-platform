-- Phase 7: BRICKR services and meeting requests, partner notes, QuidQuo stages, build log and waitlist.
-- Plan and access rules: docs/phase-7-plan.md.

-- ---------------------------------------------------------------- services

create table public.services (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name        text not null check (char_length(name) between 2 and 100),
  space       text not null default 'BRICKR' check (space in ('BRICKR', 'Outloud')),
  audience    text not null default 'Founders' check (char_length(audience) <= 60),
  format      text not null default '' check (char_length(format) <= 80),
  description text not null default '' check (char_length(description) <= 600),
  tags        text[] not null default '{}' check (cardinality(tags) <= 8),
  banner      text not null default 'Round' check (char_length(banner) <= 20),
  banner_url  text check (public.is_content_image(banner_url)),
  status      public.pub_status not null default 'draft',
  sort        int not null default 100,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger services_touch before update on public.services for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- meeting requests

create table public.requests (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  service_id   uuid not null references public.services (id) on delete restrict,
  space        text not null default 'BRICKR' check (space in ('BRICKR', 'Outloud')),
  preferred_at timestamptz not null,
  company      text not null default '' check (char_length(company) <= 160),
  note         text not null default '' check (char_length(note) <= 1000),
  status       public.application_status not null default 'new',
  owner        text check (owner is null or char_length(owner) <= 60),
  meeting_at   timestamptz,
  meeting_url  text check (meeting_url is null or (char_length(meeting_url) <= 300 and meeting_url ~ '^https://[^\s<>"]+$')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index requests_status_idx on public.requests (status, created_at desc);
create index requests_member_idx on public.requests (member_id, created_at desc);
create trigger requests_touch before update on public.requests for each row execute function public.touch_updated_at();

-- New requests: the service must be published; the space comes from the service; the preferred time
-- must be in the next 30 days; at most 5 open requests and 10 new ones a day per member.
create or replace function public.requests_before_insert() returns trigger language plpgsql security definer set search_path = '' as $$
declare sv public.services;
begin
  select * into sv from public.services where id = new.service_id;
  if not found or sv.status <> 'published' then raise exception 'service_closed' using errcode = '22023'; end if;
  new.space := sv.space;
  new.status := 'new';
  new.owner := null;
  new.meeting_at := null;
  new.meeting_url := null;
  if new.preferred_at < now() or new.preferred_at > now() + interval '30 days' then raise exception 'bad_time' using errcode = '22023'; end if;
  if (select count(*) from public.requests where member_id = new.member_id and status not in ('won', 'declined')) >= 5 then
    raise exception 'too_many_open' using errcode = '22023';
  end if;
  if (select count(*) from public.requests where member_id = new.member_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'request_limit' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger requests_before_insert before insert on public.requests for each row execute function public.requests_before_insert();

-- Partner-only notes on a request.
create table public.request_notes (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  author_id  uuid not null default auth.uid() references auth.users (id) on delete set null,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index request_notes_idx on public.request_notes (request_id, created_at);

-- ---------------------------------------------------------------- QuidQuo

create table public.qq_stages (
  id          uuid primary key default gen_random_uuid(),
  position    int not null default 1 check (position between 1 and 50),
  name        text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 300),
  progress    int not null default 0 check (progress between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger qq_stages_touch before update on public.qq_stages for each row execute function public.touch_updated_at();

create table public.qq_log (
  id         uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  title      text not null check (char_length(title) between 3 and 160),
  body       text not null default '' check (char_length(body) <= 1000),
  status     public.pub_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index qq_log_idx on public.qq_log (status, entry_date desc);
create trigger qq_log_touch before update on public.qq_log for each row execute function public.touch_updated_at();

create table public.waitlist (
  id             uuid primary key default gen_random_uuid(),
  -- Members join with their account; admins can also add people by name and email.
  member_id      uuid unique references auth.users (id) on delete cascade,
  name           text check (char_length(name) <= 120),
  email          text check (email is null or (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  role           text not null check (role in ('Founder raising capital', 'Investor or angel', 'Ecosystem partner')),
  feedback_calls boolean not null default true,
  invite_code    text not null unique default public.random_code(8),
  invited_by     uuid references public.waitlist (id) on delete set null,
  joined_at      timestamptz not null default now(),
  check (member_id is not null or email is not null)
);
create unique index waitlist_email_idx on public.waitlist (lower(email)) where email is not null;

-- Join (or update) the waitlist as the signed-in member, optionally through someone's invite code.
create or replace function public.join_waitlist(p_role text, p_feedback boolean, p_ref text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); inviter uuid; code text;
begin
  if me is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_role not in ('Founder raising capital', 'Investor or angel', 'Ecosystem partner') then raise exception 'bad_role' using errcode = '22023'; end if;
  if p_ref is not null and p_ref ~ '^[2-9A-Z]{8}$' then
    select id into inviter from public.waitlist where invite_code = p_ref and member_id is distinct from me;
  end if;
  insert into public.waitlist (member_id, role, feedback_calls, invited_by)
  values (me, p_role, coalesce(p_feedback, true), inviter)
  on conflict (member_id) do update set role = excluded.role, feedback_calls = excluded.feedback_calls
  returning invite_code into code;
  return code;
end $$;

-- ---------------------------------------------------------------- Library levels

create or replace function public.my_access_levels() returns text[] language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then '{}'::text[]
    else array['all_members']
      || case when exists (select 1 from public.enrolments en where en.member_id = auth.uid() and en.status = 'confirmed') then array['tvs_learners'] else '{}'::text[] end
      || case when exists (select 1 from public.requests r where r.member_id = auth.uid() and r.status = 'won') then array['brickr_clients'] else '{}'::text[] end
      || case when exists (select 1 from public.waitlist w where w.member_id = auth.uid()) then array['quidquo_waitlist'] else '{}'::text[] end
  end $$;

-- ---------------------------------------------------------------- row level security

alter table public.services      enable row level security;
alter table public.requests      enable row level security;
alter table public.request_notes enable row level security;
alter table public.qq_stages     enable row level security;
alter table public.qq_log        enable row level security;
alter table public.waitlist      enable row level security;

create policy "Published services are public; admins see all" on public.services
  for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "Admins manage services" on public.services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Members request for themselves" on public.requests
  for insert to authenticated with check (member_id = auth.uid());
create policy "Members see their own requests; admins see all" on public.requests
  for select to authenticated using (member_id = auth.uid() or public.is_admin());
create policy "Admins move requests" on public.requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Members withdraw new requests; admins delete any" on public.requests
  for delete to authenticated using ((member_id = auth.uid() and status = 'new') or public.is_admin());

create policy "Admins only: partner notes" on public.request_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin() and author_id = auth.uid());

create policy "QuidQuo stages are public" on public.qq_stages
  for select to anon, authenticated using (true);
create policy "Admins manage stages" on public.qq_stages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Published build log is public; admins see all" on public.qq_log
  for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "Admins manage the build log" on public.qq_log
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Members see their own waitlist entry; admins see all" on public.waitlist
  for select to authenticated using (member_id = auth.uid() or public.is_admin());
create policy "Members update their own entry" on public.waitlist
  for update to authenticated using (member_id = auth.uid() or public.is_admin()) with check (member_id = auth.uid() or public.is_admin());
create policy "Members leave; admins remove" on public.waitlist
  for delete to authenticated using (member_id = auth.uid() or public.is_admin());
create policy "Admins add people" on public.waitlist
  for insert to authenticated with check (public.is_admin());

-- ---------------------------------------------------------------- grants

revoke all on public.services, public.requests, public.request_notes, public.qq_stages, public.qq_log, public.waitlist from anon, authenticated;

grant select on public.services, public.qq_stages, public.qq_log to anon, authenticated;
grant insert, update, delete on public.services, public.qq_stages, public.qq_log to authenticated;
grant select, delete on public.requests to authenticated;
grant insert (service_id, preferred_at, company, note) on public.requests to authenticated;
grant update (status, owner, meeting_at, meeting_url) on public.requests to authenticated;
grant select, insert, delete on public.request_notes to authenticated;
grant select, delete on public.waitlist to authenticated;
grant insert (name, email, role, feedback_calls) on public.waitlist to authenticated;
grant update (role, feedback_calls) on public.waitlist to authenticated;
grant all on public.services, public.requests, public.request_notes, public.qq_stages, public.qq_log, public.waitlist to service_role;

-- Waitlist invite codes use random_code() as a column default, so signed-in callers need to run it (it only makes random text).
grant execute on function public.random_code(int) to authenticated;
revoke all on function public.requests_before_insert(), public.join_waitlist(text, boolean, text) from public;
grant execute on function public.join_waitlist(text, boolean, text) to authenticated;
