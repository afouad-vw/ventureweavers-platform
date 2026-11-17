-- Phase 17b (approved 2026-11-17): managing the full client experience. Plan: docs/phase-17-plan.md.
-- 1. Project statuses (Proposal → Pending approval → Approved → Situation assessment → Active → Renewal due →
--    Completed, plus Paused and Cancelled), moved automatically (unless switched off) or by partners, with a log.
-- 2. Request categories (extra work, scope change, meeting / call, question, document, other).
-- 3. Notes shared with the client team (client people can write them) alongside partner-only notes.
-- 4. Client leads invite team members by email.
-- 5. Project management: milestones, tasks (team or client side), weekly wrap-ups.
-- 6. The project folder is any https link (Google Drive shows its files inside the page).

-- ================================================================ 1. statuses

alter table public.projects drop constraint if exists projects_status_check;
update public.projects set status = case status when 'setup' then 'proposal' when 'assessment' then 'onboarding' else status end;
alter table public.projects add constraint projects_status_check
  check (status in ('proposal', 'pending_approval', 'approved', 'onboarding', 'active', 'paused', 'renewal', 'completed', 'cancelled'));
alter table public.projects alter column status set default 'proposal';
alter table public.projects add column status_auto boolean not null default true;
alter table public.projects alter column dimensions set default '{"Portfolio Strategy","Venture Building","Venture Scaling","Positioning"}';

alter table public.projects drop constraint if exists projects_drive_url_check;
alter table public.projects add constraint projects_drive_url_check
  check (drive_url is null or (char_length(drive_url) <= 300 and drive_url ~ '^https://[^\s<>"]+$'));

create table public.project_status_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  from_status text,
  to_status   text not null,
  auto        boolean not null default false,
  changed_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index project_status_log_idx on public.project_status_log (project_id, created_at desc);

-- Uploading a proposal moves a Proposal project to Pending approval (when automatic moves are on).
create or replace function public.projects_auto_on_proposal() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status_auto and new.status = 'proposal' and new.proposal_path is not null and old.proposal_path is null then
    new.status := 'pending_approval';
    perform set_config('vw.auto_status', 'on', true);
  end if;
  return new;
end $$;
create trigger projects_auto_on_proposal before update of proposal_path on public.projects
  for each row execute function public.projects_auto_on_proposal();

-- Every status change is logged; client people hear about the milestones that matter to them.
create or replace function public.projects_status_changed() returns trigger language plpgsql security definer set search_path = '' as $$
declare label text;
begin
  if new.status is not distinct from old.status then return null; end if;
  insert into public.project_status_log (project_id, from_status, to_status, auto, changed_by)
  values (new.id, old.status, new.status, coalesce(current_setting('vw.auto_status', true), 'off') = 'on', auth.uid());
  perform set_config('vw.auto_status', 'off', true);
  label := case new.status when 'approved' then 'is approved. Welcome aboard.' when 'onboarding' then 'has started: situation assessment.'
    when 'active' then 'is now in its ongoing phase.' when 'renewal' then 'is coming up for renewal.' when 'completed' then 'is completed. Thank you.' end;
  if label is not null then
    insert into public.notifications (member_id, text, href)
    select x, left(new.name || ' ' || label, 300), '/projects/' || new.slug from public.project_member_ids(new.id) x;
  end if;
  return null;
end $$;
create trigger projects_status_changed after update on public.projects
  for each row when (old.status is distinct from new.status) execute function public.projects_status_changed();
create or replace function public.projects_status_created() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.project_status_log (project_id, from_status, to_status, auto, changed_by) values (new.id, null, new.status, false, auth.uid());
  return null;
end $$;
create trigger projects_status_created after insert on public.projects
  for each row execute function public.projects_status_created();
-- Existing projects start their history now.
insert into public.project_status_log (project_id, from_status, to_status, auto) select id, null, status, false from public.projects;

-- Daily (cron) and after saves: date-based moves for projects with automatic moves on.
create or replace function public.project_auto_status() returns int language plpgsql security definer set search_path = '' as $$
declare n int := 0; r record; today date := (now() at time zone 'Africa/Cairo')::date; next text;
begin
  for r in select id, status, starts_on, term_months from public.projects
           where status_auto and starts_on is not null and status in ('approved', 'onboarding', 'active') loop
    next := null;
    if r.status = 'approved' and r.starts_on <= today then next := 'onboarding'; end if;
    if r.status in ('approved', 'onboarding') and (r.starts_on + interval '1 month')::date <= today then next := 'active'; end if;
    if r.status in ('approved', 'onboarding', 'active') and r.term_months is not null
       and (r.starts_on + make_interval(months => r.term_months) - interval '1 month')::date <= today then next := 'renewal'; end if;
    if next is not null and next <> r.status then
      perform set_config('vw.auto_status', 'on', true);
      update public.projects set status = next where id = r.id;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.project_auto_status() from public, anon, authenticated;
grant execute on function public.project_auto_status() to service_role;
grant execute on function public.project_member_ids(uuid) to service_role;

-- Accepting the proposal also approves the project (when automatic moves are on).
create or replace function public.client_accept_proposal(p_project uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.project_role(p_project) is distinct from 'lead' then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.projects set proposal_accepted_at = now(), proposal_accepted_by = auth.uid()
   where id = p_project and proposal_accepted_at is null and proposal_path is not null;
  if not found then raise exception 'nothing_to_accept' using errcode = '22023'; end if;
  if exists (select 1 from public.projects where id = p_project and status_auto and status in ('proposal', 'pending_approval')) then
    perform set_config('vw.auto_status', 'on', true);
    update public.projects set status = 'approved' where id = p_project;
  end if;
end $$;

-- ================================================================ 2. request categories

alter table public.project_requests
  add column category text not null default 'extra_work' check (category in ('extra_work', 'scope_change', 'meeting', 'question', 'document', 'other')),
  add column preferred_times text not null default '' check (char_length(preferred_times) <= 300),
  add column meeting_id uuid references public.project_meetings (id) on delete set null;
grant insert (category, preferred_times) on public.project_requests to authenticated;
grant update (category, preferred_times, meeting_id) on public.project_requests to authenticated;

-- Only extra work and scope changes are quoted.
create or replace function public.project_requests_priced() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'quoted' and new.category not in ('extra_work', 'scope_change') then
    raise exception 'not_priced' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger project_requests_priced before insert or update on public.project_requests
  for each row execute function public.project_requests_priced();

-- ================================================================ 3. shared notes

alter table public.project_notes add column shared boolean not null default false;
drop policy "Staff only: partner notes" on public.project_notes;
create policy "Staff see all notes; client people see shared ones" on public.project_notes for select to authenticated
  using (public.is_project_staff() or (shared and public.project_role(project_id) is not null));
create policy "Staff and client people write notes" on public.project_notes for insert to authenticated
  with check (author_id = auth.uid() and (public.is_project_staff(true) or (shared and public.project_role(project_id) is not null)));
create policy "Authors and staff edit notes" on public.project_notes for update to authenticated
  using (author_id = auth.uid() or public.is_project_staff(true))
  with check (public.is_project_staff(true) or (author_id = auth.uid() and shared));
create policy "Authors and staff delete notes" on public.project_notes for delete to authenticated
  using (author_id = auth.uid() or public.is_project_staff(true));

-- Client notes: 30 a day per person.
create or replace function public.project_notes_before() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_project_staff(true) and (select count(*) from public.project_notes n where n.author_id = auth.uid() and n.created_at > now() - interval '1 day') >= 30 then
    raise exception 'note_limit' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger project_notes_before before insert on public.project_notes for each row execute function public.project_notes_before();

-- ================================================================ 4. client leads invite team members

create or replace function public.client_invite_person(p_project uuid, p_email text, p_name text) returns text
language plpgsql security definer set search_path = '' as $$
declare e text := lower(btrim(coalesce(p_email, ''))); uid uuid; n int;
begin
  if public.project_role(p_project) is distinct from 'lead' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(e) > 200 then raise exception 'bad_email' using errcode = '22023'; end if;
  if (select count(*) from public.project_members m where m.added_by = auth.uid() and m.created_at > now() - interval '1 day') >= 10 then
    raise exception 'invite_limit' using errcode = '22023';
  end if;
  if (select count(*) from public.project_members m where m.project_id = p_project) >= 40 then raise exception 'project_full' using errcode = '22023'; end if;
  select u.id into uid from auth.users u where lower(u.email) = e;
  if uid is not null and exists (select 1 from public.admin_users a where a.user_id = uid) then raise exception 'team_account' using errcode = '22023'; end if;
  if uid is not null then
    insert into public.project_members (project_id, member_id, name, role, added_by)
    values (p_project, uid, nullif(left(btrim(coalesce(p_name, '')), 120), ''), 'team', auth.uid()) on conflict do nothing;
  else
    insert into public.project_members (project_id, email, name, role, added_by)
    values (p_project, e, nullif(left(btrim(coalesce(p_name, '')), 120), ''), 'team', auth.uid()) on conflict do nothing;
  end if;
  get diagnostics n = row_count;
  return case when n = 0 then 'already' when uid is null then 'invited' else 'added' end;
end $$;

create or replace function public.client_remove_person(p_member_row uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.project_members;
begin
  select * into m from public.project_members where id = p_member_row;
  if not found or public.project_role(m.project_id) is distinct from 'lead' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if m.role <> 'team' then raise exception 'not_allowed' using errcode = '42501'; end if;
  delete from public.project_members where id = p_member_row;
end $$;
revoke all on function public.client_invite_person(uuid, text, text), public.client_remove_person(uuid) from public;
grant execute on function public.client_invite_person(uuid, text, text), public.client_remove_person(uuid) to authenticated;

-- ================================================================ 5. project management

create table public.project_milestones (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 2 and 160),
  dimension  text not null default '' check (char_length(dimension) <= 80),
  due_on     date,
  status     text not null default 'planned' check (status in ('planned', 'in_progress', 'done')),
  sort       int not null default 100,
  created_at timestamptz not null default now()
);
create index project_milestones_idx on public.project_milestones (project_id, sort, due_on);

create table public.project_tasks (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  milestone_id    uuid references public.project_milestones (id) on delete set null,
  meeting_id      uuid references public.project_meetings (id) on delete set null,
  title           text not null check (char_length(btrim(title)) between 2 and 200),
  details         text not null default '' check (char_length(details) <= 4000),
  dimension       text not null default '' check (char_length(dimension) <= 80),
  owner_side      text not null default 'team' check (owner_side in ('team', 'client')),
  assignee        text not null default '' check (char_length(assignee) <= 120),
  assignee_member uuid references auth.users (id) on delete set null,
  due_on          date,
  status          text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),
  priority        text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  internal        boolean not null default false,
  sort            int not null default 100,
  completed_at    timestamptz,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (not (internal and owner_side = 'client'))
);
create index project_tasks_idx on public.project_tasks (project_id, status, due_on);
create index project_tasks_milestone_idx on public.project_tasks (milestone_id);
create trigger project_tasks_touch before update on public.project_tasks for each row execute function public.touch_updated_at();

create or replace function public.project_tasks_before() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then new.completed_at := now(); end if;
  if new.status <> 'done' then new.completed_at := null; end if;
  return new;
end $$;
create trigger project_tasks_before before insert or update on public.project_tasks for each row execute function public.project_tasks_before();

-- Client people update the status of client-side tasks they can see.
create or replace function public.client_set_task_status(p_task uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.project_tasks;
begin
  select * into t from public.project_tasks where id = p_task;
  if not found or t.internal or t.owner_side <> 'client' or public.project_role(t.project_id) is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_status not in ('todo', 'in_progress', 'blocked', 'done') then raise exception 'bad_status' using errcode = '22023'; end if;
  update public.project_tasks set status = p_status where id = p_task;
end $$;
revoke all on function public.client_set_task_status(uuid, text) from public;
grant execute on function public.client_set_task_status(uuid, text) to authenticated;

create table public.project_updates (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  week_of      date not null,
  summary      text not null default '' check (char_length(summary) <= 4000),
  done         text not null default '' check (char_length(done) <= 4000),
  next         text not null default '' check (char_length(next) <= 4000),
  open_points  text not null default '' check (char_length(open_points) <= 3000),
  published_at timestamptz,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index project_updates_idx on public.project_updates (project_id, week_of desc);
create trigger project_updates_touch before update on public.project_updates for each row execute function public.touch_updated_at();

alter table public.project_status_log  enable row level security;
alter table public.project_milestones  enable row level security;
alter table public.project_tasks       enable row level security;
alter table public.project_updates     enable row level security;

create policy "Client people see their project's history; staff see all" on public.project_status_log for select to authenticated
  using (public.is_project_staff() or public.project_role(project_id) is not null);
create policy "Client people see milestones; staff see all" on public.project_milestones for select to authenticated
  using (public.is_project_staff() or public.project_role(project_id) is not null);
create policy "Staff manage milestones" on public.project_milestones for all to authenticated
  using (public.is_project_staff(true)) with check (public.is_project_staff(true));
create policy "Client people see shared tasks; staff see all" on public.project_tasks for select to authenticated
  using (public.is_project_staff() or (not internal and public.project_role(project_id) is not null));
create policy "Staff manage tasks" on public.project_tasks for all to authenticated
  using (public.is_project_staff(true)) with check (public.is_project_staff(true));
create policy "Client people see published wrap-ups; staff see all" on public.project_updates for select to authenticated
  using (public.is_project_staff() or (published_at is not null and public.project_role(project_id) is not null));
create policy "Staff manage wrap-ups" on public.project_updates for all to authenticated
  using (public.is_project_staff(true)) with check (public.is_project_staff(true));

revoke all on public.project_status_log, public.project_milestones, public.project_tasks, public.project_updates from anon, authenticated;
grant select on public.project_status_log to authenticated;
grant select, insert, update, delete on public.project_milestones, public.project_tasks, public.project_updates to authenticated;
grant all on public.project_status_log, public.project_milestones, public.project_tasks, public.project_updates to service_role;

-- Comments on tasks and wrap-ups too.
alter table public.project_comments drop constraint if exists project_comments_target_type_check;
alter table public.project_comments add constraint project_comments_target_type_check
  check (target_type in ('project', 'request', 'meeting', 'task', 'update'));

-- Bell: a task assigned to a client person; a wrap-up published.
create or replace function public.notify_project_task() returns trigger language plpgsql security definer set search_path = '' as $$
declare pr public.projects;
begin
  if new.assignee_member is null or new.internal then return null; end if;
  if tg_op = 'UPDATE' and new.assignee_member is not distinct from old.assignee_member then return null; end if;
  select * into pr from public.projects where id = new.project_id;
  perform public.notify(new.assignee_member, left('Task for you on ' || pr.name || ': ' || new.title, 300), '/projects/' || pr.slug || '?tab=plan');
  return null;
end $$;
create trigger project_tasks_notify after insert or update of assignee_member on public.project_tasks
  for each row execute function public.notify_project_task();

create or replace function public.notify_project_update() returns trigger language plpgsql security definer set search_path = '' as $$
declare pr public.projects;
begin
  if new.published_at is null or (tg_op = 'UPDATE' and old.published_at is not null) then return null; end if;
  select * into pr from public.projects where id = new.project_id;
  insert into public.notifications (member_id, text, href)
  select x, left('Weekly wrap-up for ' || pr.name || ' is ready.', 300), '/projects/' || pr.slug || '?tab=plan' from public.project_member_ids(new.project_id) x;
  return null;
end $$;
create trigger project_updates_notify after insert or update of published_at on public.project_updates
  for each row execute function public.notify_project_update();
