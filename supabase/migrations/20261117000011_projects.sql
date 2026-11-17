-- Phase 17a (approved 2026-11-17): BRICKR client projects (fractional leadership and mentorship).
-- Plan: docs/phase-17-plan.md. Projects, the client people on them, proposal and scope, extra requests with
-- quotes the client lead approves, comments and partner notes, the Google Drive folder and meetings.
-- Access area "projects" (view / manage). Client people see only their projects; portfolio people also see
-- the portfolio's venture projects. Assessment, tasks (17b), invoices and analysis (17c) come next.

-- ================================================================ access area

create or replace function public.admin_perm_list() returns text[] language sql immutable set search_path = '' as $$
  select array[
    'overview.view',
    'contacts.view', 'contacts.manage',
    'businesses.view', 'businesses.manage',
    'projects.view', 'projects.manage',
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

-- ================================================================ projects

create table public.projects (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name                 text not null check (char_length(btrim(name)) between 2 and 120),
  kind                 text not null default 'venture' check (kind in ('portfolio', 'venture')),
  parent_id            uuid references public.projects (id) on delete restrict,
  company_id           uuid references public.companies (id) on delete set null,
  deal_id              uuid references public.deals (id) on delete set null,
  service              text not null default 'fractional_leadership' check (service in ('fractional_leadership', 'mentorship')),
  status               text not null default 'setup' check (status in ('setup', 'assessment', 'proposal', 'active', 'paused', 'completed', 'cancelled')),
  health               text not null default 'green' check (health in ('green', 'amber', 'red')),
  summary              text not null default '' check (char_length(summary) <= 800),
  goals                text[] not null default '{}' check (cardinality(goals) <= 12),
  dimensions           text[] not null default '{"Portfolio Strategy","Venture Building","Governance & Support","Positioning"}' check (cardinality(dimensions) <= 10),
  starts_on            date,
  term_months          int check (term_months is null or term_months between 1 and 60),
  retainer_amount      numeric(12, 2) check (retainer_amount is null or retainer_amount >= 0),
  currency             text not null default 'USD' check (currency in ('EGP', 'USD')),
  billing              text not null default 'end_of_month' check (billing in ('end_of_month', 'start_of_month')),
  cadence              text not null default '' check (char_length(cadence) <= 300),
  key_terms            text not null default '' check (char_length(key_terms) <= 6000),
  proposal_path        text check (proposal_path is null or proposal_path ~ '^proposals/\d{4}-\d{2}/[0-9a-f-]{36}\.pdf$'),
  proposal_name        text check (proposal_name is null or char_length(proposal_name) <= 160),
  proposal_accepted_at timestamptz,
  proposal_accepted_by uuid references auth.users (id) on delete set null,
  drive_url            text check (drive_url is null or (char_length(drive_url) <= 300 and drive_url ~ '^https://drive\.google\.com/drive/(u/[0-9]+/)?folders/[A-Za-z0-9_-]{10,}(\?[A-Za-z0-9=&_.-]*)?$')),
  calendly_url         text check (calendly_url is null or (char_length(calendly_url) <= 300 and calendly_url ~ '^https://calendly\.com/[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)?$')),
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (kind = 'venture' or parent_id is null),
  check (parent_id is null or parent_id <> id)
);
create index projects_parent_idx on public.projects (parent_id);
create index projects_company_idx on public.projects (company_id);
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

-- A venture can sit under a portfolio project (one level only).
create or replace function public.projects_check_parent() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.parent_id is not null and not exists (select 1 from public.projects p where p.id = new.parent_id and p.kind = 'portfolio') then
    raise exception 'parent_not_portfolio' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and new.kind = 'venture' and old.kind = 'portfolio' and exists (select 1 from public.projects c where c.parent_id = new.id) then
    raise exception 'portfolio_has_ventures' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger projects_check_parent before insert or update of parent_id, kind on public.projects for each row execute function public.projects_check_parent();

-- ---------------------------------------------------------------- client people

create table public.project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  member_id  uuid references auth.users (id) on delete cascade,
  email      text check (email is null or (email = lower(email) and char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+$')),
  name       text check (name is null or char_length(name) <= 120),
  role       text not null default 'team' check (role in ('lead', 'team')),
  added_by   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (member_id is not null or email is not null)
);
create unique index project_members_member_idx on public.project_members (project_id, member_id) where member_id is not null;
create unique index project_members_email_idx on public.project_members (project_id, email) where email is not null and member_id is null;
create index project_members_lookup_idx on public.project_members (member_id);

-- The signed-in member's role on a project: their own, or the one they hold on its portfolio. Null if none.
create or replace function public.project_role(p_project uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.project_members m
  join public.projects p on p.id = p_project
  where (m.project_id = p.id or m.project_id = p.parent_id)
    and auth.uid() is not null
    and (m.member_id = auth.uid() or (m.member_id is null and m.email = (select lower(u.email) from auth.users u where u.id = auth.uid())))
  order by (m.role = 'lead') desc
  limit 1 $$;
create or replace function public.is_project_staff(p_manage boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_any_perm(case when p_manage then '{projects.manage}'::text[] else '{projects.view}'::text[] end) $$;
revoke all on function public.project_role(uuid), public.is_project_staff(boolean) from public;
grant execute on function public.project_role(uuid), public.is_project_staff(boolean) to authenticated, service_role;

-- ---------------------------------------------------------------- scope

create table public.project_scope_items (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  dimension  text not null default '' check (char_length(dimension) <= 80),
  title      text not null check (char_length(btrim(title)) between 2 and 160),
  details    text not null default '' check (char_length(details) <= 1500),
  outputs    text[] not null default '{}' check (cardinality(outputs) <= 12),
  sort       int not null default 100,
  created_at timestamptz not null default now()
);
create index project_scope_items_idx on public.project_scope_items (project_id, sort);

-- ---------------------------------------------------------------- extra requests

create table public.project_requests (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects (id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 3 and 160),
  details          text not null default '' check (char_length(details) <= 4000),
  source           text not null default 'client' check (source in ('client', 'team')),
  received_note    text not null default '' check (char_length(received_note) <= 300),
  raised_by        uuid default auth.uid() references auth.users (id) on delete set null,
  status           text not null default 'submitted' check (status in ('submitted', 'in_review', 'quoted', 'approved', 'client_declined', 'declined', 'in_progress', 'done', 'cancelled')),
  price            numeric(12, 2) check (price is null or price >= 0),
  currency         text not null default 'USD' check (currency in ('EGP', 'USD')),
  response         text not null default '' check (char_length(response) <= 4000),
  requirements     text not null default '' check (char_length(requirements) <= 2000),
  timeline         text not null default '' check (char_length(timeline) <= 200),
  decline_reason   text not null default '' check (char_length(decline_reason) <= 1000),
  responded_by     uuid references auth.users (id) on delete set null,
  responded_at     timestamptz,
  decided_by       uuid references auth.users (id) on delete set null,
  decided_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (status <> 'quoted' or price is not null)
);
create index project_requests_idx on public.project_requests (project_id, created_at desc);
create trigger project_requests_touch before update on public.project_requests for each row execute function public.touch_updated_at();

-- Client requests start as Submitted with no response; 20 a day per member. Staff add requests received
-- in person (source 'team'). Clients can't change a request afterwards except through client_decide_request().
create or replace function public.project_requests_before() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.raised_by := auth.uid();
    if public.is_project_staff(true) then
      return new;
    end if;
    if public.project_role(new.project_id) is null then raise exception 'not_allowed' using errcode = '42501'; end if;
    new.source := 'client'; new.received_note := ''; new.status := 'submitted'; new.price := null; new.response := '';
    new.requirements := ''; new.timeline := ''; new.decline_reason := ''; new.responded_by := null; new.responded_at := null;
    new.decided_by := null; new.decided_at := null;
    if (select count(*) from public.project_requests r where r.raised_by = auth.uid() and r.created_at > now() - interval '1 day') >= 20 then
      raise exception 'request_limit' using errcode = '22023';
    end if;
    return new;
  end if;
  -- Updates: staff only (client decisions go through the function, which runs as definer with this flag).
  if current_setting('vw.client_decision', true) = 'on' then return new; end if;
  if not public.is_project_staff(true) then raise exception 'not_allowed' using errcode = '42501'; end if;
  new.project_id := old.project_id; new.raised_by := old.raised_by; new.source := old.source;
  new.decided_by := old.decided_by; new.decided_at := old.decided_at;
  -- Once the client has approved a quote, its price and currency are fixed.
  if old.status in ('approved', 'in_progress', 'done') and (new.price is distinct from old.price or new.currency is distinct from old.currency) then
    raise exception 'price_locked' using errcode = '22023';
  end if;
  if new.status is distinct from old.status then
    if new.status = 'quoted' then new.responded_by := auth.uid(); new.responded_at := now(); end if;
    if new.status = 'declined' then new.responded_by := auth.uid(); new.responded_at := now(); end if;
    -- Approval belongs to the client lead.
    if new.status in ('approved', 'client_declined') then raise exception 'client_decides' using errcode = '22023'; end if;
    if new.status in ('in_progress', 'done') and old.status not in ('approved', 'in_progress', 'done') and coalesce(old.price, 0) > 0 then
      raise exception 'needs_approval' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
create trigger project_requests_before before insert or update on public.project_requests for each row execute function public.project_requests_before();

-- The client lead approves or declines a quote.
create or replace function public.client_decide_request(p_request uuid, p_approve boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare r public.project_requests;
begin
  select * into r from public.project_requests where id = p_request for update;
  if not found or public.project_role(r.project_id) is distinct from 'lead' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if r.status <> 'quoted' then raise exception 'not_quoted' using errcode = '22023'; end if;
  perform set_config('vw.client_decision', 'on', true);
  update public.project_requests
     set status = case when p_approve then 'approved' else 'client_declined' end, decided_by = auth.uid(), decided_at = now()
   where id = p_request;
  perform set_config('vw.client_decision', 'off', true);
  return case when p_approve then 'approved' else 'client_declined' end;
end $$;
revoke all on function public.client_decide_request(uuid, boolean) from public;
grant execute on function public.client_decide_request(uuid, boolean) to authenticated;

-- The client lead accepts the proposal (once; the time and person are kept).
create or replace function public.client_accept_proposal(p_project uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.project_role(p_project) is distinct from 'lead' then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.projects set proposal_accepted_at = now(), proposal_accepted_by = auth.uid()
   where id = p_project and proposal_accepted_at is null and proposal_path is not null;
  if not found then raise exception 'nothing_to_accept' using errcode = '22023'; end if;
end $$;
revoke all on function public.client_accept_proposal(uuid) from public;
grant execute on function public.client_accept_proposal(uuid) to authenticated;

-- ---------------------------------------------------------------- comments and partner notes

create table public.project_comments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  target_type text not null default 'project' check (target_type in ('project', 'request', 'meeting')),
  target_id   uuid,
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  internal    boolean not null default false,
  author_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index project_comments_idx on public.project_comments (project_id, target_type, target_id, created_at);

create table public.project_notes (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 4000),
  pinned     boolean not null default false,
  author_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index project_notes_idx on public.project_notes (project_id, pinned desc, created_at desc);

-- ---------------------------------------------------------------- meetings

create table public.project_meetings (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects (id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 2 and 160),
  kind             text not null default 'weekly' check (kind in ('kickoff', 'weekly', 'review', 'checkin', 'other')),
  starts_at        timestamptz not null,
  minutes          int not null default 60 check (minutes between 15 and 480),
  meet_url         text check (meet_url is null or (char_length(meet_url) <= 300 and meet_url ~ '^https://[^\s<>"]+$')),
  agenda           text not null default '' check (char_length(agenda) <= 3000),
  notes            text not null default '' check (char_length(notes) <= 8000),
  status           text not null default 'scheduled' check (status in ('scheduled', 'done', 'cancelled')),
  source           text not null default 'team' check (source in ('team', 'calendly')),
  calendly_invitee text unique check (calendly_invitee is null or calendly_invitee ~ '^https://api\.calendly\.com/scheduled_events/[A-Za-z0-9-]{8,64}/invitees/[A-Za-z0-9-]{8,64}$'),
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index project_meetings_idx on public.project_meetings (project_id, starts_at);
create trigger project_meetings_touch before update on public.project_meetings for each row execute function public.touch_updated_at();

-- A session the client booked in the project's Calendly becomes a meeting (one per booking).
create or replace function public.record_project_booking(p_project uuid, p_invitee text, p_start timestamptz, p_join text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare mid uuid;
begin
  if public.project_role(p_project) is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_invitee is null or p_invitee !~ '^https://api\.calendly\.com/scheduled_events/[A-Za-z0-9-]{8,64}/invitees/[A-Za-z0-9-]{8,64}$' then
    raise exception 'bad_booking' using errcode = '22023';
  end if;
  select id into mid from public.project_meetings where calendly_invitee = p_invitee;
  if mid is not null then return mid; end if;
  insert into public.project_meetings (project_id, title, kind, starts_at, meet_url, source, calendly_invitee, created_by)
  values (p_project, 'Session booked in Calendly', 'other',
          case when p_start between now() - interval '1 day' and now() + interval '1 year' then p_start else now() + interval '1 day' end,
          case when p_join ~ '^https://[^\s<>"]+$' and char_length(p_join) <= 300 then p_join end,
          'calendly', p_invitee, auth.uid())
  returning id into mid;
  return mid;
end $$;
revoke all on function public.record_project_booking(uuid, text, timestamptz, text) from public;
grant execute on function public.record_project_booking(uuid, text, timestamptz, text) to authenticated;

-- ================================================================ row level security

alter table public.projects            enable row level security;
alter table public.project_members     enable row level security;
alter table public.project_scope_items enable row level security;
alter table public.project_requests    enable row level security;
alter table public.project_comments    enable row level security;
alter table public.project_notes       enable row level security;
alter table public.project_meetings    enable row level security;

create policy "Client people see their projects; staff see all" on public.projects for select to authenticated
  using (public.is_project_staff() or public.project_role(id) is not null);
create policy "Staff create projects" on public.projects for insert to authenticated with check (public.is_project_staff(true));
create policy "Staff edit projects" on public.projects for update to authenticated using (public.is_project_staff(true)) with check (public.is_project_staff(true));
create policy "Staff delete projects" on public.projects for delete to authenticated using (public.is_project_staff(true));

create policy "Client people see who's on their project; staff see all" on public.project_members for select to authenticated
  using (public.is_project_staff() or public.project_role(project_id) is not null);
create policy "Staff manage project people" on public.project_members for all to authenticated
  using (public.is_project_staff(true)) with check (public.is_project_staff(true));

create policy "Client people read scope; staff see all" on public.project_scope_items for select to authenticated
  using (public.is_project_staff() or public.project_role(project_id) is not null);
create policy "Staff manage scope" on public.project_scope_items for all to authenticated
  using (public.is_project_staff(true)) with check (public.is_project_staff(true));

create policy "Client people see their project's requests; staff see all" on public.project_requests for select to authenticated
  using (public.is_project_staff() or public.project_role(project_id) is not null);
create policy "Client people and staff raise requests" on public.project_requests for insert to authenticated
  with check (public.is_project_staff(true) or public.project_role(project_id) is not null);
create policy "Staff respond to requests" on public.project_requests for update to authenticated
  using (public.is_project_staff(true)) with check (public.is_project_staff(true));
create policy "Staff delete requests" on public.project_requests for delete to authenticated using (public.is_project_staff(true));

create policy "Client people see shared comments; staff see all" on public.project_comments for select to authenticated
  using (public.is_project_staff() or (not internal and public.project_role(project_id) is not null));
create policy "Client people and staff comment" on public.project_comments for insert to authenticated
  with check (author_id = auth.uid() and (public.is_project_staff(true) or (not internal and public.project_role(project_id) is not null)));
create policy "Authors and staff remove comments" on public.project_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_project_staff(true));

create policy "Staff only: partner notes" on public.project_notes for all to authenticated
  using (public.is_project_staff()) with check (public.is_project_staff(true) and author_id = auth.uid());

create policy "Client people see their meetings; staff see all" on public.project_meetings for select to authenticated
  using (public.is_project_staff() or public.project_role(project_id) is not null);
create policy "Staff manage meetings" on public.project_meetings for all to authenticated
  using (public.is_project_staff(true)) with check (public.is_project_staff(true));

revoke all on public.projects, public.project_members, public.project_scope_items, public.project_requests,
  public.project_comments, public.project_notes, public.project_meetings from anon, authenticated;
grant select, insert, update, delete on public.projects, public.project_members, public.project_scope_items,
  public.project_notes, public.project_meetings to authenticated;
grant select, delete on public.project_comments, public.project_requests to authenticated;
grant insert (project_id, target_type, target_id, body, internal) on public.project_comments to authenticated;
grant insert (project_id, title, details, source, received_note, status, price, currency, response, requirements, timeline) on public.project_requests to authenticated;
grant update (title, details, received_note, status, price, currency, response, requirements, timeline, decline_reason) on public.project_requests to authenticated;
grant all on public.projects, public.project_members, public.project_scope_items, public.project_requests,
  public.project_comments, public.project_notes, public.project_meetings to service_role;

-- ================================================================ bell notifications

-- Everyone on a project (members with an account), including the portfolio's people for a venture.
create or replace function public.project_member_ids(p_project uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct m.member_id from public.project_members m join public.projects p on p.id = p_project
  where m.member_id is not null and (m.project_id = p.id or m.project_id = p.parent_id) $$;
revoke all on function public.project_member_ids(uuid) from public;

create or replace function public.notify_project_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pr public.projects; href text;
begin
  select * into pr from public.projects where id = new.project_id;
  href := '/projects/' || pr.slug || '?tab=requests';
  if tg_op = 'INSERT' then
    if new.source = 'team' then
      insert into public.notifications (member_id, text, href)
      select x, left('New request on ' || pr.name || ': ' || new.title, 300), href from public.project_member_ids(new.project_id) x;
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'quoted' then
      insert into public.notifications (member_id, text, href)
      select m.member_id, left('Quote ready for your approval: ' || new.title, 300), href
        from public.project_members m where m.role = 'lead' and m.member_id is not null and m.project_id in (pr.id, pr.parent_id);
    elsif new.status in ('declined', 'in_progress', 'done') and new.raised_by is not null and new.raised_by <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then
      perform public.notify(new.raised_by, left('Your request "' || new.title || '" is ' ||
        case new.status when 'declined' then 'declined' when 'in_progress' then 'in progress' else 'done' end || '.', 300), href);
    end if;
  end if;
  return null;
end $$;
create trigger project_requests_notify after insert or update of status on public.project_requests
  for each row execute function public.notify_project_request();

create or replace function public.notify_project_meeting() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pr public.projects;
begin
  if new.source = 'calendly' and tg_op = 'INSERT' then return null; end if;
  if tg_op = 'UPDATE' and new.starts_at = old.starts_at and new.status = old.status then return null; end if;
  select * into pr from public.projects where id = new.project_id;
  insert into public.notifications (member_id, text, href)
  select x, left(case when new.status = 'cancelled' then 'Meeting cancelled: ' else 'Meeting: ' end || new.title || ', ' || public.cairo_when(new.starts_at) || ' (Cairo).', 300),
         '/projects/' || pr.slug || '?tab=meetings'
    from public.project_member_ids(new.project_id) x where new.status <> 'done';
  return null;
end $$;
create trigger project_meetings_notify after insert or update of starts_at, status on public.project_meetings
  for each row execute function public.notify_project_meeting();

create or replace function public.notify_project_member() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pr public.projects;
begin
  if new.member_id is null then return null; end if;
  select * into pr from public.projects where id = new.project_id;
  perform public.notify(new.member_id, left('You''ve been added to the project ' || pr.name || '.', 300), '/projects/' || pr.slug);
  return null;
end $$;
create trigger project_members_notify after insert on public.project_members for each row execute function public.notify_project_member();

-- ================================================================ private files (proposals now; assessment files in 17b)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-files', 'project-files', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
