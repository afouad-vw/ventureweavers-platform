-- Phase 9: payment requests (bank transfer, admin marks paid), full refunds for program seats,
-- and one admin-only list of every payment. Plan: docs/phase-9-plan.md.

-- ---------------------------------------------------------------- payment requests

create table public.payment_requests (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references auth.users (id) on delete restrict,
  item            text not null check (char_length(btrim(item)) between 2 and 120),
  space           text not null default 'BRICKR' check (space in ('Outloud', 'TVS', 'BRICKR', 'QuidQuo', 'House')),
  amount_piasters int not null check (amount_piasters between 100 and 1000000000),
  due_on          date,
  note            text not null default '' check (char_length(note) <= 500),
  reference       text not null unique default ('VWP-' || public.random_code(6)),
  status          text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'refunded')),
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  paid_at         timestamptz,
  marked_by       uuid references auth.users (id) on delete set null,
  closed_at       timestamptz
);
create index payment_requests_member_idx on public.payment_requests (member_id, created_at desc);
create index payment_requests_status_idx on public.payment_requests (status, created_at desc);
create trigger payment_requests_touch before update on public.payment_requests
  for each row execute function public.touch_updated_at();

-- Only pending requests can be edited; status moves only through the functions below.
create or replace function public.payment_requests_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status or new.reference is distinct from old.reference
       or new.member_id is distinct from old.member_id or new.paid_at is distinct from old.paid_at
       or new.marked_by is distinct from old.marked_by or new.closed_at is distinct from old.closed_at then
      if current_setting('vw.payment_status_change', true) is distinct from 'on' then raise exception 'use_status_functions'; end if;
    elsif old.status <> 'pending' then
      raise exception 'not_editable';
    end if;
  elsif tg_op = 'DELETE' then
    if old.status in ('paid', 'refunded') then raise exception 'keep_money_records'; end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger payment_requests_guard before update or delete on public.payment_requests
  for each row execute function public.payment_requests_guard();

-- New requests start pending, made by the admin creating them.
create or replace function public.payment_requests_defaults() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.status := 'pending';
  new.reference := 'VWP-' || public.random_code(6);
  new.created_by := auth.uid();
  new.paid_at := null; new.marked_by := null; new.closed_at := null;
  return new;
end $$;
create trigger payment_requests_defaults before insert on public.payment_requests
  for each row execute function public.payment_requests_defaults();

create or replace function public.admin_request_status(p_request uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.payment_requests;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into r from public.payment_requests where id = p_request for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  -- Allowed: pending → paid or cancelled; paid → refunded (full refunds only).
  if not ((r.status = 'pending' and p_status in ('paid', 'cancelled')) or (r.status = 'paid' and p_status = 'refunded')) then
    raise exception 'bad_transition';
  end if;
  perform set_config('vw.payment_status_change', 'on', true);
  update public.payment_requests set
    status = p_status,
    paid_at = case when p_status = 'paid' then now() else paid_at end,
    marked_by = case when p_status = 'paid' then auth.uid() else marked_by end,
    closed_at = case when p_status in ('cancelled', 'refunded') then now() else closed_at end
  where id = p_request;
  perform set_config('vw.payment_status_change', 'off', true);
  insert into public.audit_log (actor, action, entity, entity_id, before, after)
  values (auth.uid(), 'payment_request.' || p_status, 'payment_requests', p_request::text,
          jsonb_build_object('status', r.status), jsonb_build_object('status', p_status));
end $$;

-- ---------------------------------------------------------------- program seats: full refunds

alter table public.enrolments add column refunded_at timestamptz;

create or replace function public.admin_refund_enrolment(p_enrolment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare en public.enrolments;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into en from public.enrolments where id = p_enrolment for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if en.status <> 'confirmed' then raise exception 'bad_transition'; end if;
  update public.enrolments set status = 'cancelled', cancelled_at = now(), refunded_at = now() where id = p_enrolment;
  insert into public.audit_log (actor, action, entity, entity_id, before)
  values (auth.uid(), 'enrolment.refund', 'enrolments', p_enrolment::text, jsonb_build_object('status', en.status));
end $$;

-- ---------------------------------------------------------------- access rules

alter table public.payment_requests enable row level security;
create policy "Members read their own payment requests; admins read all" on public.payment_requests
  for select to authenticated using (member_id = auth.uid() or public.is_admin());
create policy "Admins create payment requests" on public.payment_requests
  for insert to authenticated with check (public.is_admin());
create policy "Admins edit payment requests" on public.payment_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete payment requests" on public.payment_requests
  for delete to authenticated using (public.is_admin());

revoke all on public.payment_requests from anon, authenticated;
grant select, delete on public.payment_requests to authenticated;
grant insert (member_id, item, space, amount_piasters, due_on, note) on public.payment_requests to authenticated;
grant update (item, space, amount_piasters, due_on, note) on public.payment_requests to authenticated;
grant all on public.payment_requests to service_role;

revoke all on function public.payment_requests_guard(), public.payment_requests_defaults(),
  public.admin_request_status(uuid, text), public.admin_refund_enrolment(uuid) from public;
grant execute on function public.admin_request_status(uuid, text), public.admin_refund_enrolment(uuid) to authenticated;

-- ---------------------------------------------------------------- one list of every payment (admins only)

create view public.payments_ledger with (security_invoker = true) as
  select 'seat'::text as kind, b.id, b.member_id,
         e.title || case when b.seats > 1 then ' · ' || b.seats || ' seats' else '' end as item,
         case when e.type = 'masterclass' then 'TVS' else 'Outloud' end as space,
         coalesce(p.method, 'bank_transfer') as method,
         b.amount_piasters,
         case b.status
           when 'reserved' then case when b.hold_expires_at > now() then 'pending' else 'expired' end
           when 'confirmed' then 'paid'
           else b.status::text end as status,
         b.pay_reference as reference, b.created_at, p.paid_at, p.marked_by
    from public.bookings b
    join public.events e on e.id = b.event_id
    left join lateral (select * from public.payments x where x.booking_id = b.id order by x.created_at desc limit 1) p on true
   where public.is_admin()
  union all
  select 'program', en.id, en.member_id, pr.name || ' · ' || c.label, 'TVS', 'bank_transfer', en.amount_piasters,
         case en.status when 'offered' then 'pending' when 'confirmed' then 'paid'
           else case when en.refunded_at is not null then 'refunded' else 'cancelled' end end,
         en.pay_reference, en.offered_at, en.confirmed_at, en.paid_marked_by
    from public.enrolments en
    join public.cohorts c on c.id = en.cohort_id
    join public.programs pr on pr.id = c.program_id
   where public.is_admin()
  union all
  select 'request', r.id, r.member_id, r.item, r.space, 'bank_transfer', r.amount_piasters, r.status,
         r.reference, r.created_at, r.paid_at, r.marked_by
    from public.payment_requests r
   where public.is_admin();

revoke all on public.payments_ledger from anon, authenticated;
grant select on public.payments_ledger to authenticated, service_role;
