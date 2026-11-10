-- Phase 8: Live mode for shows. Questions, upvotes, The Pick, polls and stage control.
-- Plan: docs/phase-8-plan.md. Members only reach live data through the functions below;
-- admins (2-step) read and write the tables directly.

-- ---------------------------------------------------------------- tables

create table public.live_sessions (
  event_id         uuid primary key references public.events (id) on delete cascade,
  is_open          boolean not null default false,
  moment           smallint not null default 1 check (moment between 1 and 4),
  picked_question  uuid,
  opened_at        timestamptz,
  ended_at         timestamptz,
  feedback_sent_at timestamptz,
  -- Bumped on every change, so phones know to refresh (Realtime sends only this row).
  version          bigint not null default 0,
  updated_at       timestamptz not null default now()
);

create table public.live_questions (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  member_id  uuid not null references auth.users (id) on delete cascade,
  text       text not null check (char_length(btrim(text)) between 1 and 280),
  anonymous  boolean not null default false,
  status     text not null default 'waiting' check (status in ('waiting', 'approved', 'hidden')),
  picked_at  timestamptz,
  created_at timestamptz not null default now()
);
create index live_questions_event_idx on public.live_questions (event_id, status);
alter table public.live_sessions add constraint live_sessions_picked_fk
  foreign key (picked_question) references public.live_questions (id) on delete set null;

create table public.live_votes (
  question_id uuid not null references public.live_questions (id) on delete cascade,
  member_id   uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (question_id, member_id)
);

create table public.live_polls (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  question   text not null default 'What should we discuss next?' check (char_length(btrim(question)) between 1 and 160),
  is_open    boolean not null default false,
  created_at timestamptz not null default now()
);
-- One open poll per show.
create unique index live_polls_one_open on public.live_polls (event_id) where is_open;

create table public.live_poll_options (
  id       uuid primary key default gen_random_uuid(),
  poll_id  uuid not null references public.live_polls (id) on delete cascade,
  label    text not null check (char_length(btrim(label)) between 1 and 80),
  position smallint not null default 0
);
create index live_poll_options_idx on public.live_poll_options (poll_id, position);

create table public.live_poll_votes (
  poll_id    uuid not null references public.live_polls (id) on delete cascade,
  member_id  uuid not null references auth.users (id) on delete cascade,
  option_id  uuid not null references public.live_poll_options (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, member_id)
);

-- ---------------------------------------------------------------- helpers

create or replace function public.has_show_ticket(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bookings b
    where b.event_id = p_event and b.member_id = auth.uid() and b.status = 'confirmed');
$$;

create or replace function public.can_join_live(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_show_ticket(p_event)
     and exists (select 1 from public.live_sessions s where s.event_id = p_event and s.is_open);
$$;

-- Bump the show's version after any change, so open phones refresh.
create or replace function public.live_bump(p_event uuid) returns void
language sql security definer set search_path = '' as $$
  update public.live_sessions set version = version + 1, updated_at = now() where event_id = p_event;
$$;

create or replace function public.live_touch() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record; ev uuid;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if tg_table_name in ('live_questions', 'live_polls') then ev := r.event_id;
  elsif tg_table_name = 'live_votes' then select q.event_id into ev from public.live_questions q where q.id = r.question_id;
  elsif tg_table_name in ('live_poll_options', 'live_poll_votes') then select p.event_id into ev from public.live_polls p where p.id = r.poll_id;
  end if;
  if ev is not null then perform public.live_bump(ev); end if;
  return null;
end $$;

create trigger live_questions_touch after insert or update or delete on public.live_questions for each row execute function public.live_touch();
create trigger live_votes_touch after insert or delete on public.live_votes for each row execute function public.live_touch();
create trigger live_polls_touch after insert or update or delete on public.live_polls for each row execute function public.live_touch();
create trigger live_poll_options_touch after insert or update or delete on public.live_poll_options for each row execute function public.live_touch();
create trigger live_poll_votes_touch after insert or update or delete on public.live_poll_votes for each row execute function public.live_touch();

create or replace function public.live_session_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.is_open, new.moment, new.picked_question, new.ended_at, new.feedback_sent_at)
     is distinct from (old.is_open, old.moment, old.picked_question, old.ended_at, old.feedback_sent_at) then
    new.version := old.version + 1;
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger live_sessions_version before update on public.live_sessions for each row execute function public.live_session_touch();

create or replace function public.live_asker(p_member uuid, p_anonymous boolean)
returns text language sql stable security definer set search_path = '' as $$
  select case when p_anonymous then 'Anonymous'
    else coalesce(nullif(split_part(btrim((select p.full_name from public.profiles p where p.id = p_member)), ' ', 1), ''), 'A member') end;
$$;

-- ---------------------------------------------------------------- what a member sees

create or replace function public.live_state(p_event uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s public.live_sessions; me uuid := auth.uid(); poll public.live_polls; result jsonb;
begin
  if me is null or not public.has_show_ticket(p_event) then raise exception 'no_ticket'; end if;
  select * into s from public.live_sessions where event_id = p_event;
  if s.event_id is null or not s.is_open then
    return jsonb_build_object('open', false, 'ended', s.ended_at is not null, 'moment', coalesce(s.moment, 1));
  end if;
  select * into poll from public.live_polls where event_id = p_event and is_open;

  result := jsonb_build_object(
    'open', true,
    'moment', s.moment,
    'version', s.version,
    'picked', (select jsonb_build_object('id', q.id, 'text', q.text, 'who', public.live_asker(q.member_id, q.anonymous))
               from public.live_questions q where q.id = s.picked_question),
    'questions', coalesce((
      select jsonb_agg(x order by (x->>'votes')::int desc, x->>'created_at') from (
        select jsonb_build_object(
          'id', q.id, 'text', q.text, 'status', q.status, 'mine', q.member_id = me,
          'votes', (select count(*) from public.live_votes v where v.question_id = q.id),
          'voted', exists (select 1 from public.live_votes v where v.question_id = q.id and v.member_id = me),
          'created_at', q.created_at) as x
        from public.live_questions q
        where q.event_id = p_event and (q.status = 'approved' or (q.member_id = me and q.status = 'waiting'))
      ) t), '[]'::jsonb),
    'asked', (select count(*) from public.live_questions q where q.event_id = p_event and q.member_id = me),
    'poll', case when poll.id is null then null else jsonb_build_object(
      'id', poll.id, 'question', poll.question,
      'my_vote', (select pv.option_id from public.live_poll_votes pv where pv.poll_id = poll.id and pv.member_id = me),
      'options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label,
          'votes', (select count(*) from public.live_poll_votes pv where pv.option_id = o.id)) order by o.position, o.label)
        from public.live_poll_options o where o.poll_id = poll.id), '[]'::jsonb)) end
  );
  return result;
end $$;

-- ---------------------------------------------------------------- member actions

create or replace function public.live_ask(p_event uuid, p_text text, p_anonymous boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); id uuid;
begin
  if not public.can_join_live(p_event) then raise exception 'live_closed'; end if;
  if char_length(btrim(coalesce(p_text, ''))) not between 1 and 280 then raise exception 'bad_text'; end if;
  if (select count(*) from public.live_questions q where q.event_id = p_event and q.member_id = me) >= 5 then
    raise exception 'question_limit';
  end if;
  insert into public.live_questions (event_id, member_id, text, anonymous)
  values (p_event, me, btrim(p_text), coalesce(p_anonymous, false)) returning live_questions.id into id;
  return id;
end $$;

-- Toggle an upvote on an approved question. Returns true when the vote is now on.
create or replace function public.live_upvote(p_question uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); q public.live_questions;
begin
  select * into q from public.live_questions where id = p_question;
  if q.id is null or q.status <> 'approved' or not public.can_join_live(q.event_id) then raise exception 'live_closed'; end if;
  delete from public.live_votes where question_id = p_question and member_id = me;
  if found then return false; end if;
  insert into public.live_votes (question_id, member_id) values (p_question, me);
  return true;
end $$;

-- Vote, change the vote, or (same option again) take it back. Returns the option now chosen, or null.
create or replace function public.live_poll_vote(p_option uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); o public.live_poll_options; p public.live_polls; cur uuid;
begin
  select * into o from public.live_poll_options where id = p_option;
  select * into p from public.live_polls where id = o.poll_id;
  if p.id is null or not p.is_open or not public.can_join_live(p.event_id) then raise exception 'poll_closed'; end if;
  select option_id into cur from public.live_poll_votes where poll_id = p.id and member_id = me;
  if cur = p_option then
    delete from public.live_poll_votes where poll_id = p.id and member_id = me;
    return null;
  end if;
  insert into public.live_poll_votes (poll_id, member_id, option_id) values (p.id, me, p_option)
  on conflict (poll_id, member_id) do update set option_id = excluded.option_id, created_at = now();
  return p_option;
end $$;

-- ---------------------------------------------------------------- admin actions

create or replace function public.admin_live_open(p_event uuid, p_open boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if (select type from public.events where id = p_event) in ('private_session') then raise exception 'not_a_show'; end if;
  insert into public.live_sessions (event_id) values (p_event) on conflict (event_id) do nothing;
  update public.live_sessions
     set is_open = p_open,
         opened_at = case when p_open then coalesce(opened_at, now()) else opened_at end,
         ended_at = case when p_open then null else now() end
   where event_id = p_event;
  insert into public.audit_log (actor, action, entity, entity_id)
  values (auth.uid(), case when p_open then 'live.open' else 'live.close' end, 'events', p_event::text);
end $$;

create or replace function public.admin_live_moment(p_event uuid, p_moment int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.live_sessions set moment = p_moment::smallint where event_id = p_event;
  if not found then raise exception 'not_live'; end if;
end $$;

-- The Pick: a random approved question that hasn't been picked yet goes on stage.
create or replace function public.admin_live_pick(p_event uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare q uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if not exists (select 1 from public.live_sessions where event_id = p_event) then raise exception 'not_live'; end if;
  select id into q from public.live_questions
   where event_id = p_event and status = 'approved' and picked_at is null
   order by random() limit 1;
  if q is null then raise exception 'no_approved'; end if;
  update public.live_questions set picked_at = now() where id = q;
  update public.live_sessions set picked_question = q, moment = 1 where event_id = p_event;
  return q;
end $$;

-- Open one poll for its show (closing any other), or close it.
create or replace function public.admin_live_poll_open(p_poll uuid, p_open boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare ev uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select event_id into ev from public.live_polls where id = p_poll;
  if ev is null then raise exception 'not_found'; end if;
  if p_open then
    if (select count(*) from public.live_poll_options where poll_id = p_poll) < 2 then raise exception 'needs_options'; end if;
    update public.live_polls set is_open = false where event_id = ev and id <> p_poll and is_open;
  end if;
  update public.live_polls set is_open = p_open where id = p_poll;
end $$;

-- End show: close polls, move to Your Voice. Returns true the first time (so the feedback email goes once).
create or replace function public.admin_live_end(p_event uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare first boolean;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.live_polls set is_open = false where event_id = p_event and is_open;
  select feedback_sent_at is null into first from public.live_sessions where event_id = p_event;
  if first is null then raise exception 'not_live'; end if;
  update public.live_sessions set moment = 4, feedback_sent_at = coalesce(feedback_sent_at, now()) where event_id = p_event;
  insert into public.audit_log (actor, action, entity, entity_id) values (auth.uid(), 'live.end', 'events', p_event::text);
  return first;
end $$;

-- ---------------------------------------------------------------- access rules

alter table public.live_sessions enable row level security;
alter table public.live_questions enable row level security;
alter table public.live_votes enable row level security;
alter table public.live_polls enable row level security;
alter table public.live_poll_options enable row level security;
alter table public.live_poll_votes enable row level security;

-- Ticket holders may read their show's session row (open/closed, moment, version), so Realtime can tell them when it opens.
create policy "Ticket holders and admins read live sessions" on public.live_sessions
  for select to authenticated using (public.is_admin() or public.has_show_ticket(event_id));
create policy "Admins manage live questions" on public.live_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins read live votes" on public.live_votes
  for select to authenticated using (public.is_admin());
create policy "Admins manage polls" on public.live_polls
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage poll options" on public.live_poll_options
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins read poll votes" on public.live_poll_votes
  for select to authenticated using (public.is_admin());

revoke all on public.live_sessions, public.live_questions, public.live_votes, public.live_polls,
  public.live_poll_options, public.live_poll_votes from anon, authenticated;
grant select on public.live_sessions, public.live_votes, public.live_poll_votes to authenticated;
grant select, delete on public.live_questions to authenticated;
grant update (status) on public.live_questions to authenticated;
grant select, insert, update, delete on public.live_polls, public.live_poll_options to authenticated;
grant all on public.live_sessions, public.live_questions, public.live_votes, public.live_polls,
  public.live_poll_options, public.live_poll_votes to service_role;

revoke all on function public.has_show_ticket(uuid), public.can_join_live(uuid), public.live_bump(uuid),
  public.live_touch(), public.live_asker(uuid, boolean), public.live_state(uuid), public.live_ask(uuid, text, boolean),
  public.live_upvote(uuid), public.live_poll_vote(uuid), public.admin_live_open(uuid, boolean),
  public.admin_live_moment(uuid, int), public.admin_live_pick(uuid), public.admin_live_poll_open(uuid, boolean),
  public.admin_live_end(uuid) from public;
grant execute on function public.has_show_ticket(uuid), public.can_join_live(uuid), public.live_state(uuid),
  public.live_ask(uuid, text, boolean), public.live_upvote(uuid), public.live_poll_vote(uuid),
  public.admin_live_open(uuid, boolean), public.admin_live_moment(uuid, int), public.admin_live_pick(uuid),
  public.admin_live_poll_open(uuid, boolean), public.admin_live_end(uuid) to authenticated;

-- Realtime: phones listen to their show's session row only.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.live_sessions;
  end if;
end $$;
