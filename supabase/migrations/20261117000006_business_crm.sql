-- Phase 15 (approved 2026-11-17), part 3: business CRM. Businesses we work with, the people at them
-- (members and added contacts), B2B deals and the team's activity log. Staff with "Businesses & deals" only.

-- ================================================================ businesses

create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  type        text check (type is null or type = any (public.business_type_list())),
  stage       text check (stage is null or (stage = any (public.stage_list()) and type = 'Venture')),
  website     text check (website is null or (char_length(website) <= 200 and website ~ '^https?://[^\s<>"]+\.[^\s<>"]+$')),
  linkedin    text check (linkedin is null or (char_length(linkedin) <= 200 and linkedin ~ '^https://www\.linkedin\.com/(company|school|showcase|in)/[^\s<>"]+$')),
  country     text check (country is null or char_length(country) <= 80),
  tags        text[] not null default '{}' check (cardinality(tags) <= 10),
  notes       text not null default '' check (char_length(notes) <= 4000),
  owner       uuid references auth.users (id) on delete set null,
  status      text not null default 'active' check (status in ('active', 'archived')),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index companies_name_idx on public.companies (lower(name));
create trigger companies_touch before update on public.companies for each row execute function public.touch_updated_at();

-- People at a business: a member (by account) or a contact the partners added.
create table public.company_people (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  member_id   uuid references auth.users (id) on delete cascade,
  contact_id  uuid references public.contacts (id) on delete cascade,
  role        text check (role is null or char_length(role) <= 80),
  created_at  timestamptz not null default now(),
  check ((member_id is null) <> (contact_id is null))
);
create unique index company_people_member_idx on public.company_people (company_id, member_id) where member_id is not null;
create unique index company_people_contact_idx on public.company_people (company_id, contact_id) where contact_id is not null;
create index company_people_member_lookup on public.company_people (member_id);

-- ================================================================ B2B deals

create table public.deals (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  title          text not null check (char_length(title) between 2 and 160),
  type           text not null default 'Revenue-based' check (type in ('Revenue-based', 'Acquisition', 'Co-creation', 'Branding')),
  stage          text not null default 'Lead' check (stage in ('Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost')),
  value          numeric(14, 2) check (value is null or value >= 0),
  currency       text not null default 'EGP' check (currency in ('EGP', 'USD')),
  expected_close date,
  owner          uuid references auth.users (id) on delete set null,
  service_id     uuid references public.services (id) on delete set null,
  program_id     uuid references public.programs (id) on delete set null,
  notes          text not null default '' check (char_length(notes) <= 4000),
  closed_at      timestamptz,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index deals_company_idx on public.deals (company_id);
create index deals_stage_idx on public.deals (stage);
create trigger deals_touch before update on public.deals for each row execute function public.touch_updated_at();

-- ================================================================ activity

create table public.company_activities (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  deal_id     uuid references public.deals (id) on delete set null,
  kind        text not null check (kind in ('note', 'call', 'meeting', 'email', 'task', 'stage')),
  body        text not null check (char_length(body) between 1 and 4000),
  due_at      timestamptz,
  done_at     timestamptz,
  author      uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  check (kind = 'task' or due_at is null)
);
create index company_activities_company_idx on public.company_activities (company_id, created_at desc);
create index company_activities_tasks_idx on public.company_activities (due_at) where kind = 'task' and done_at is null;

-- Won/Lost set the closing time; stage changes go to the business's activity log.
create or replace function public.deals_close_time() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.stage in ('Won', 'Lost') then
    new.closed_at := case when tg_op = 'UPDATE' and old.stage in ('Won', 'Lost') then coalesce(old.closed_at, now()) else now() end;
  else
    new.closed_at := null;
  end if;
  return new;
end $$;
create trigger deals_close_time before insert or update on public.deals for each row execute function public.deals_close_time();

create or replace function public.deals_log_stage() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.company_activities (company_id, deal_id, kind, body, author) values (new.company_id, new.id, 'stage', 'Deal added: ' || new.title || ' (' || new.stage || ')', auth.uid());
  elsif new.stage is distinct from old.stage then
    insert into public.company_activities (company_id, deal_id, kind, body, author) values (new.company_id, new.id, 'stage', new.title || ': ' || old.stage || ' to ' || new.stage, auth.uid());
  end if;
  return null;
end $$;
create trigger deals_log_stage after insert or update on public.deals for each row execute function public.deals_log_stage();

-- ================================================================ access: the "Businesses & deals" area

alter table public.companies enable row level security;
alter table public.company_people enable row level security;
alter table public.deals enable row level security;
alter table public.company_activities enable row level security;

create policy "Business viewers read businesses" on public.companies for select to authenticated using (public.has_any_perm('{businesses.view}'::text[]));
create policy "Business managers add businesses" on public.companies for insert to authenticated with check (public.has_any_perm('{businesses.manage}'::text[]));
create policy "Business managers edit businesses" on public.companies for update to authenticated using (public.has_any_perm('{businesses.manage}'::text[])) with check (public.has_any_perm('{businesses.manage}'::text[]));
create policy "Business managers delete businesses" on public.companies for delete to authenticated using (public.has_any_perm('{businesses.manage}'::text[]));

create policy "Business viewers read people" on public.company_people for select to authenticated using (public.has_any_perm('{businesses.view,contacts.view}'::text[]));
create policy "Business managers link people" on public.company_people for insert to authenticated with check (public.has_any_perm('{businesses.manage}'::text[]));
create policy "Business managers edit people" on public.company_people for update to authenticated using (public.has_any_perm('{businesses.manage}'::text[])) with check (public.has_any_perm('{businesses.manage}'::text[]));
create policy "Business managers unlink people" on public.company_people for delete to authenticated using (public.has_any_perm('{businesses.manage}'::text[]));

create policy "Business viewers read deals" on public.deals for select to authenticated using (public.has_any_perm('{businesses.view}'::text[]));
create policy "Business managers add deals" on public.deals for insert to authenticated with check (public.has_any_perm('{businesses.manage}'::text[]));
create policy "Business managers edit deals" on public.deals for update to authenticated using (public.has_any_perm('{businesses.manage}'::text[])) with check (public.has_any_perm('{businesses.manage}'::text[]));
create policy "Business managers delete deals" on public.deals for delete to authenticated using (public.has_any_perm('{businesses.manage}'::text[]));

create policy "Business viewers read activity" on public.company_activities for select to authenticated using (public.has_any_perm('{businesses.view}'::text[]));
create policy "Business managers log activity" on public.company_activities for insert to authenticated with check (public.has_any_perm('{businesses.manage}'::text[]) and kind <> 'stage');
create policy "Business managers edit activity" on public.company_activities for update to authenticated using (public.has_any_perm('{businesses.manage}'::text[])) with check (public.has_any_perm('{businesses.manage}'::text[]));
create policy "Business managers delete activity" on public.company_activities for delete to authenticated using (public.has_any_perm('{businesses.manage}'::text[]) and kind <> 'stage');

grant select, insert, update, delete on public.companies, public.company_people, public.deals, public.company_activities to authenticated;

create or replace function public.admin_perm_list() returns text[] language sql immutable set search_path = '' as $$
  select array[
    'overview.view',
    'contacts.view', 'contacts.manage',
    'businesses.view', 'businesses.manage',
    'requests.view', 'requests.manage',
    'messages.view', 'messages.manage',
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
