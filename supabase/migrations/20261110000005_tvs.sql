-- Phase 6a: TVS programs, "Notify me", applications, cohorts, enrolments, masterclasses.
-- Plan and access rules: docs/phase-6-plan.md.

-- ---------------------------------------------------------------- masterclasses ride on events

alter type public.event_type add value if not exists 'masterclass';

alter table public.events
  add column space  text not null default 'Outloud' check (public.is_space(space)),
  add column format text check (format is null or format in ('In person', 'Online'));

-- The Meet link for online events, kept apart so only confirmed ticket holders (and admins) can read it.
create table public.event_links (
  event_id   uuid primary key references public.events (id) on delete cascade,
  meet_url   text check (meet_url is null or (char_length(meet_url) <= 300 and meet_url ~ '^https://[^\s<>"]+$')),
  updated_at timestamptz not null default now()
);
create trigger event_links_touch before update on public.event_links for each row execute function public.touch_updated_at();

alter table public.event_links enable row level security;
create policy "Ticket holders and admins read event links" on public.event_links
  for select to authenticated using (
    public.is_admin() or exists (
      select 1 from public.bookings b where b.event_id = event_links.event_id and b.member_id = auth.uid() and b.status = 'confirmed'));
create policy "Admins write event links" on public.event_links
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- programs

create table public.programs (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name           text not null check (char_length(name) between 2 and 80),
  kind           text not null default '360 program' check (kind in ('Foundation', '360 program')),
  description    text not null default '' check (char_length(description) <= 600),
  weeks          text not null default '[N]' check (char_length(weeks) <= 20),
  price_piasters int check (price_piasters >= 0),
  requires_tvac  boolean not null default true,
  tags           text[] not null default '{}' check (cardinality(tags) <= 8),
  banner         text not null default 'Room' check (char_length(banner) <= 20),
  banner_url     text check (public.is_content_image(banner_url)),
  status         text not null default 'draft' check (status in ('draft', 'open', 'in_development', 'closed')),
  sort           int not null default 100,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger programs_touch before update on public.programs for each row execute function public.touch_updated_at();

-- "Notify me" for programs in development.
create table public.program_interest (
  member_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, program_id)
);

-- ---------------------------------------------------------------- applications

create type public.application_status as enum ('new', 'intro_call', 'proposal', 'won', 'declined');

create table public.applications (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id    uuid not null references public.programs (id) on delete restrict,
  role          text not null check (char_length(role) between 1 and 80),
  venture_stage text not null default '' check (char_length(venture_stage) <= 80),
  building      text not null check (char_length(btrim(building)) between 10 and 1000),
  why_now       text not null default '' check (char_length(why_now) <= 1000),
  status        public.application_status not null default 'new',
  owner         text check (owner is null or char_length(owner) <= 60),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- One open application per member and program; apply again after a decline.
create unique index applications_one_open on public.applications (member_id, program_id) where status <> 'declined';
create index applications_status_idx on public.applications (status, created_at desc);
create trigger applications_touch before update on public.applications for each row execute function public.touch_updated_at();

-- Only open programs take applications.
create or replace function public.applications_check_program() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.programs where id = new.program_id and status = 'open') then
    raise exception 'program_closed' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger applications_check_program before insert on public.applications
  for each row execute function public.applications_check_program();

-- ---------------------------------------------------------------- cohorts and enrolments

create table public.cohorts (
  id         uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete restrict,
  label      text not null default 'Cohort [NO.]' check (char_length(label) between 1 and 60),
  starts_on  date,
  capacity   int check (capacity is null or capacity between 1 and 1000),
  status     text not null default 'planned' check (status in ('planned', 'running', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger cohorts_touch before update on public.cohorts for each row execute function public.touch_updated_at();

create type public.enrolment_status as enum ('offered', 'confirmed', 'cancelled');

create table public.enrolments (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references auth.users (id) on delete cascade,
  cohort_id       uuid not null references public.cohorts (id) on delete restrict,
  application_id  uuid references public.applications (id) on delete set null,
  status          public.enrolment_status not null default 'offered',
  amount_piasters int not null check (amount_piasters >= 0),
  pay_reference   text not null unique,
  offered_at      timestamptz not null default now(),
  confirmed_at    timestamptz,
  paid_marked_by  uuid references auth.users (id) on delete set null,
  cancelled_at    timestamptz
);
create unique index enrolments_one_active on public.enrolments (member_id, cohort_id) where status <> 'cancelled';
create index enrolments_cohort_idx on public.enrolments (cohort_id, status);

-- Seats in a cohort that are offered or confirmed.
create or replace function public.cohort_seats_taken(p_cohort uuid) returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.enrolments where cohort_id = p_cohort and status in ('offered', 'confirmed') $$;

-- Admin: offer a seat to an applicant. Moves the application to Won. A zero amount (sponsored seat)
-- confirms straight away; otherwise the member pays by bank transfer and an admin marks it paid.
create or replace function public.admin_offer_seat(p_application uuid, p_cohort uuid, p_amount int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.applications; c public.cohorts; e_id uuid;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'bad_amount' using errcode = '22023'; end if;
  select * into a from public.applications where id = p_application for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if a.status = 'declined' then raise exception 'declined' using errcode = '22023'; end if;
  select * into c from public.cohorts where id = p_cohort for update;
  if not found or c.status = 'finished' then raise exception 'cohort_closed' using errcode = '22023'; end if;
  if c.program_id <> a.program_id then raise exception 'wrong_program' using errcode = '22023'; end if;
  if c.capacity is not null and public.cohort_seats_taken(p_cohort) >= c.capacity then raise exception 'cohort_full' using errcode = '22023'; end if;
  if exists (select 1 from public.enrolments where member_id = a.member_id and cohort_id = p_cohort and status <> 'cancelled') then
    raise exception 'already_enrolled' using errcode = '23505';
  end if;

  insert into public.enrolments (member_id, cohort_id, application_id, status, amount_piasters, pay_reference, confirmed_at, paid_marked_by)
  values (a.member_id, p_cohort, a.id,
          case when p_amount = 0 then 'confirmed'::public.enrolment_status else 'offered' end,
          p_amount, 'VWT-' || public.random_code(6),
          case when p_amount = 0 then now() end, case when p_amount = 0 then auth.uid() end)
  returning id into e_id;
  update public.applications set status = 'won' where id = a.id;
  insert into public.audit_log (actor, action, entity, entity_id, after)
  values (auth.uid(), 'enrolment.offer', 'enrolments', e_id::text, jsonb_build_object('application', a.id, 'cohort', p_cohort, 'amount', p_amount));
  return e_id;
end $$;

create or replace function public.admin_confirm_enrolment(p_enrolment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare en public.enrolments;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into en from public.enrolments where id = p_enrolment for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if en.status = 'confirmed' then return; end if;
  if en.status <> 'offered' then raise exception 'not_payable' using errcode = '22023'; end if;
  update public.enrolments set status = 'confirmed', confirmed_at = now(), paid_marked_by = auth.uid() where id = p_enrolment;
  insert into public.audit_log (actor, action, entity, entity_id, after)
  values (auth.uid(), 'enrolment.paid', 'enrolments', p_enrolment::text, jsonb_build_object('amount', en.amount_piasters));
end $$;

create or replace function public.admin_cancel_enrolment(p_enrolment uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare en public.enrolments;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into en from public.enrolments where id = p_enrolment for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if en.status = 'cancelled' then return; end if;
  update public.enrolments set status = 'cancelled', cancelled_at = now() where id = p_enrolment;
  insert into public.audit_log (actor, action, entity, entity_id, before)
  values (auth.uid(), 'enrolment.cancel', 'enrolments', p_enrolment::text, jsonb_build_object('status', en.status));
end $$;

-- Library: confirmed learners in any TVS cohort hold the "TVS learners" level.
create or replace function public.my_access_levels() returns text[] language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then '{}'::text[]
    else array['all_members'] || case when exists (
      select 1 from public.enrolments en where en.member_id = auth.uid() and en.status = 'confirmed')
      then array['tvs_learners'] else '{}'::text[] end
  end $$;

-- ---------------------------------------------------------------- row level security

alter table public.programs         enable row level security;
alter table public.program_interest enable row level security;
alter table public.applications     enable row level security;
alter table public.cohorts          enable row level security;
alter table public.enrolments       enable row level security;

create policy "Open and upcoming programs are public; admins see all" on public.programs
  for select to anon, authenticated using (status in ('open', 'in_development') or public.is_admin());
create policy "Admins create programs" on public.programs for insert to authenticated with check (public.is_admin());
create policy "Admins edit programs" on public.programs for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete programs" on public.programs for delete to authenticated using (public.is_admin());

create policy "Members manage their own Notify me" on public.program_interest
  for insert to authenticated with check (member_id = auth.uid());
create policy "Members see their own Notify me; admins see all" on public.program_interest
  for select to authenticated using (member_id = auth.uid() or public.is_admin());
create policy "Members remove their own Notify me" on public.program_interest
  for delete to authenticated using (member_id = auth.uid());

create policy "Members apply for themselves" on public.applications
  for insert to authenticated with check (member_id = auth.uid() and status = 'new' and owner is null);
create policy "Members see their own applications; admins see all" on public.applications
  for select to authenticated using (member_id = auth.uid() or public.is_admin());
create policy "Admins move applications" on public.applications
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete applications" on public.applications
  for delete to authenticated using (public.is_admin());

create policy "Learners see their cohorts; admins see all" on public.cohorts
  for select to authenticated using (public.is_admin() or exists (
    select 1 from public.enrolments en where en.cohort_id = cohorts.id and en.member_id = auth.uid() and en.status <> 'cancelled'));
create policy "Admins manage cohorts" on public.cohorts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Members see their own enrolments; admins see all" on public.enrolments
  for select to authenticated using (member_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- grants

revoke all on public.event_links, public.programs, public.program_interest, public.applications,
  public.cohorts, public.enrolments from anon, authenticated;

grant select on public.programs to anon, authenticated;
grant insert, update, delete on public.programs to authenticated;
grant select, delete on public.program_interest to authenticated;
grant insert (program_id) on public.program_interest to authenticated;
grant select on public.applications to authenticated;
grant insert (program_id, role, venture_stage, building, why_now) on public.applications to authenticated;
grant update (status, owner) on public.applications to authenticated;
grant delete on public.applications to authenticated;
grant select on public.cohorts to authenticated;
grant insert, update, delete on public.cohorts to authenticated;
grant select on public.enrolments to authenticated;
grant select on public.event_links to authenticated;
grant insert, update, delete on public.event_links to authenticated;
grant all on public.event_links, public.programs, public.program_interest, public.applications,
  public.cohorts, public.enrolments to service_role;

revoke all on function public.cohort_seats_taken(uuid), public.admin_offer_seat(uuid, uuid, int),
  public.admin_confirm_enrolment(uuid), public.admin_cancel_enrolment(uuid), public.applications_check_program() from public;
grant execute on function public.admin_offer_seat(uuid, uuid, int), public.admin_confirm_enrolment(uuid),
  public.admin_cancel_enrolment(uuid) to authenticated;
grant execute on function public.cohort_seats_taken(uuid) to service_role;
