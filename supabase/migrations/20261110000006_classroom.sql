-- Phase 6b: the classroom. Everything here is only for learners confirmed in the cohort, and admins.
-- Plan and access rules: docs/phase-6-plan.md.

-- Is the signed-in member a confirmed learner in this cohort?
create or replace function public.is_cohort_learner(p_cohort uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.enrolments where cohort_id = p_cohort and member_id = auth.uid() and status = 'confirmed') $$;

create or replace function public.can_see_cohort(p_cohort uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.is_cohort_learner(p_cohort) $$;

-- ---------------------------------------------------------------- modules and steps

create table public.modules (
  id         uuid primary key default gen_random_uuid(),
  cohort_id  uuid not null references public.cohorts (id) on delete cascade,
  position   int not null default 1 check (position between 1 and 100),
  title      text not null check (char_length(title) between 2 and 120),
  summary    text not null default '' check (char_length(summary) <= 1000),
  -- Opens on this date (Cairo); empty means "opens later".
  opens_at   timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index modules_cohort_idx on public.modules (cohort_id, position);
create trigger modules_touch before update on public.modules for each row execute function public.touch_updated_at();

create or replace function public.module_is_open(p_module uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select opens_at <= now() from public.modules where id = p_module), false) $$;

create table public.module_steps (
  id         uuid primary key default gen_random_uuid(),
  module_id  uuid not null references public.modules (id) on delete cascade,
  position   int not null default 1 check (position between 1 and 100),
  title      text not null check (char_length(title) between 2 and 160),
  kind       text not null default 'reading' check (kind in ('reading', 'case', 'assignment', 'library', 'video', 'task')),
  meta       text not null default '' check (char_length(meta) <= 60),
  url        text check (public.is_safe_link(url)),
  created_at timestamptz not null default now()
);
create index module_steps_idx on public.module_steps (module_id, position);

create table public.step_progress (
  member_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  step_id    uuid not null references public.module_steps (id) on delete cascade,
  done_at    timestamptz not null default now(),
  primary key (member_id, step_id)
);

-- Learners tick steps only in open modules of their own cohort.
create or replace function public.step_progress_check() returns trigger language plpgsql security definer set search_path = '' as $$
declare m public.modules;
begin
  select mo.* into m from public.module_steps s join public.modules mo on mo.id = s.module_id where s.id = new.step_id;
  if not found or not public.is_cohort_learner(m.cohort_id) then raise exception 'not_in_cohort' using errcode = '42501'; end if;
  if m.opens_at is null or m.opens_at > now() then raise exception 'module_locked' using errcode = '22023'; end if;
  return new;
end $$;
create trigger step_progress_check before insert on public.step_progress for each row execute function public.step_progress_check();

-- ---------------------------------------------------------------- assignments and submissions

create table public.assignments (
  id         uuid primary key default gen_random_uuid(),
  module_id  uuid not null references public.modules (id) on delete cascade,
  title      text not null check (char_length(title) between 2 and 160),
  brief      text not null default '' check (char_length(brief) <= 2000),
  due_at     timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assignments_module_idx on public.assignments (module_id);
create trigger assignments_touch before update on public.assignments for each row execute function public.touch_updated_at();

create table public.submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  member_id     uuid not null references auth.users (id) on delete cascade,
  file_path     text not null check (file_path ~ '^submissions/[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{1,5}$'),
  file_name     text not null check (char_length(file_name) between 1 and 200),
  file_size     bigint not null check (file_size between 1 and 20971520),
  status        text not null default 'submitted' check (status in ('submitted', 'reviewed')),
  submitted_at  timestamptz not null default now(),
  feedback      text check (char_length(feedback) <= 4000),
  reviewed_by   uuid references auth.users (id) on delete set null,
  reviewed_at   timestamptz,
  unique (assignment_id, member_id)
);
create index submissions_status_idx on public.submissions (status, submitted_at desc);

-- Can the signed-in learner hand in (or replace) work for this assignment?
create or replace function public.can_submit(p_assignment uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assignments a join public.modules m on m.id = a.module_id
    where a.id = p_assignment and public.is_cohort_learner(m.cohort_id) and m.opens_at <= now()
      and not exists (select 1 from public.submissions s where s.assignment_id = a.id and s.member_id = auth.uid() and s.status = 'reviewed')) $$;

-- Hand in or replace work. The file must already be in the learner's own submissions folder.
-- Returns the replaced file path (if any) so the server can delete it.
create or replace function public.submit_assignment(p_assignment uuid, p_path text, p_name text, p_size bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); old text;
begin
  if me is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not public.can_submit(p_assignment) then raise exception 'cannot_submit' using errcode = '42501'; end if;
  if p_path is null or p_path !~ ('^submissions/' || me::text || '/[0-9a-f-]{36}\.[a-z0-9]{1,5}$') then raise exception 'bad_path' using errcode = '22023'; end if;
  select file_path into old from public.submissions where assignment_id = p_assignment and member_id = me;
  insert into public.submissions (assignment_id, member_id, file_path, file_name, file_size)
  values (p_assignment, me, p_path, left(p_name, 200), p_size)
  on conflict (assignment_id, member_id) do update
    set file_path = excluded.file_path, file_name = excluded.file_name, file_size = excluded.file_size, submitted_at = now();
  return case when old is distinct from p_path then old end;
end $$;

-- Admin feedback; marks the work reviewed (the learner can no longer replace it).
create or replace function public.admin_review_submission(p_submission uuid, p_feedback text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_feedback is null or char_length(btrim(p_feedback)) < 2 then raise exception 'feedback_needed' using errcode = '22023'; end if;
  update public.submissions set status = 'reviewed', feedback = left(p_feedback, 4000), reviewed_by = auth.uid(), reviewed_at = now() where id = p_submission;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into public.audit_log (actor, action, entity, entity_id) values (auth.uid(), 'submission.review', 'submissions', p_submission::text);
end $$;

-- Admin: reopen reviewed work so the learner can hand in again.
create or replace function public.admin_reopen_submission(p_submission uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.submissions set status = 'submitted', reviewed_at = null where id = p_submission;
  insert into public.audit_log (actor, action, entity, entity_id) values (auth.uid(), 'submission.reopen', 'submissions', p_submission::text);
end $$;

-- ---------------------------------------------------------------- live sessions, files, discussion

create table public.class_sessions (
  id             uuid primary key default gen_random_uuid(),
  cohort_id      uuid not null references public.cohorts (id) on delete cascade,
  title          text not null check (char_length(title) between 2 and 160),
  starts_at      timestamptz not null,
  meet_url       text check (meet_url is null or (char_length(meet_url) <= 300 and meet_url ~ '^https://[^\s<>"]+$')),
  recording_url  text check (recording_url is null or (char_length(recording_url) <= 500 and recording_url ~ '^https://[^\s<>"]+$')),
  recording_note text not null default '' check (char_length(recording_note) <= 40),
  created_at     timestamptz not null default now()
);
create index class_sessions_idx on public.class_sessions (cohort_id, starts_at);

create table public.cohort_files (
  id         uuid primary key default gen_random_uuid(),
  cohort_id  uuid not null references public.cohorts (id) on delete cascade,
  module_id  uuid references public.modules (id) on delete set null,
  title      text not null check (char_length(title) between 2 and 160),
  note       text not null default '' check (char_length(note) <= 80),
  file_path  text not null check (file_path ~ '^files/\d{4}-\d{2}/[0-9a-f-]{36}\.[a-z0-9]{1,5}$'),
  file_name  text not null check (char_length(file_name) between 1 and 200),
  file_size  bigint not null check (file_size between 1 and 20971520),
  created_at timestamptz not null default now()
);
create index cohort_files_idx on public.cohort_files (cohort_id, created_at desc);

create table public.cohort_posts (
  id         uuid primary key default gen_random_uuid(),
  cohort_id  uuid not null references public.cohorts (id) on delete cascade,
  member_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  is_host    boolean not null default false,
  removed_at timestamptz,
  created_at timestamptz not null default now()
);
create index cohort_posts_idx on public.cohort_posts (cohort_id, created_at);

-- Host posts are marked by the database, never by the browser; at most 30 posts a day per member.
create or replace function public.cohort_posts_before() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.is_host := public.is_admin();
  new.removed_at := null;
  if not new.is_host and (select count(*) from public.cohort_posts where member_id = new.member_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'post_limit' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger cohort_posts_before before insert on public.cohort_posts for each row execute function public.cohort_posts_before();

-- Private storage for cohort documents and learners' submissions. No browser access: uploads use
-- signed upload links made on the server after the checks above; downloads use 5-minute links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cohort-files', 'cohort-files', false, 20971520, array[
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'application/x-zip-compressed'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------- row level security

alter table public.modules        enable row level security;
alter table public.module_steps   enable row level security;
alter table public.step_progress  enable row level security;
alter table public.assignments    enable row level security;
alter table public.submissions    enable row level security;
alter table public.class_sessions enable row level security;
alter table public.cohort_files   enable row level security;
alter table public.cohort_posts   enable row level security;

create policy "Cohort learners and admins read modules" on public.modules
  for select to authenticated using (public.can_see_cohort(cohort_id));
create policy "Admins manage modules" on public.modules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Cohort learners and admins read steps" on public.module_steps
  for select to authenticated using (public.can_see_cohort((select cohort_id from public.modules m where m.id = module_id)));
create policy "Admins manage steps" on public.module_steps
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Learners tick their own steps" on public.step_progress
  for insert to authenticated with check (member_id = auth.uid());
create policy "Learners see their own progress; admins see all" on public.step_progress
  for select to authenticated using (member_id = auth.uid() or public.is_admin());
create policy "Learners untick their own steps" on public.step_progress
  for delete to authenticated using (member_id = auth.uid());

create policy "Cohort learners and admins read assignments" on public.assignments
  for select to authenticated using (public.can_see_cohort((select cohort_id from public.modules m where m.id = module_id)));
create policy "Admins manage assignments" on public.assignments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Learners see their own work; admins see all" on public.submissions
  for select to authenticated using (member_id = auth.uid() or public.is_admin());
create policy "Admins remove submissions" on public.submissions
  for delete to authenticated using (public.is_admin());

create policy "Cohort learners and admins read sessions" on public.class_sessions
  for select to authenticated using (public.can_see_cohort(cohort_id));
create policy "Admins manage sessions" on public.class_sessions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Cohort learners and admins read files" on public.cohort_files
  for select to authenticated using (public.can_see_cohort(cohort_id));
create policy "Admins manage files" on public.cohort_files
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Cohort learners and admins read the discussion" on public.cohort_posts
  for select to authenticated using (public.can_see_cohort(cohort_id) and (removed_at is null or public.is_admin()));
create policy "Cohort learners and admins post" on public.cohort_posts
  for insert to authenticated with check (member_id = auth.uid() and public.can_see_cohort(cohort_id));
create policy "Authors delete their own posts; admins remove any" on public.cohort_posts
  for delete to authenticated using (member_id = auth.uid() or public.is_admin());
create policy "Admins hide posts" on public.cohort_posts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- grants

revoke all on public.modules, public.module_steps, public.step_progress, public.assignments, public.submissions,
  public.class_sessions, public.cohort_files, public.cohort_posts from anon, authenticated;

grant select on public.modules, public.module_steps, public.assignments, public.class_sessions, public.cohort_files to authenticated;
grant insert, update, delete on public.modules, public.module_steps, public.assignments, public.class_sessions, public.cohort_files to authenticated;
grant select, delete on public.step_progress to authenticated;
grant insert (step_id) on public.step_progress to authenticated;
grant select, delete on public.submissions to authenticated;
grant select, delete on public.cohort_posts to authenticated;
grant insert (cohort_id, body) on public.cohort_posts to authenticated;
grant update (removed_at) on public.cohort_posts to authenticated;
grant all on public.modules, public.module_steps, public.step_progress, public.assignments, public.submissions,
  public.class_sessions, public.cohort_files, public.cohort_posts to service_role;

revoke all on function public.is_cohort_learner(uuid), public.can_see_cohort(uuid), public.module_is_open(uuid),
  public.step_progress_check(), public.can_submit(uuid), public.submit_assignment(uuid, text, text, bigint),
  public.admin_review_submission(uuid, text), public.admin_reopen_submission(uuid), public.cohort_posts_before() from public;
grant execute on function public.is_cohort_learner(uuid), public.can_see_cohort(uuid), public.module_is_open(uuid),
  public.can_submit(uuid), public.submit_assignment(uuid, text, text, bigint),
  public.admin_review_submission(uuid, text), public.admin_reopen_submission(uuid) to authenticated;
grant execute on function public.can_see_cohort(uuid), public.is_cohort_learner(uuid) to service_role;
