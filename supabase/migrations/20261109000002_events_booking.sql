-- Phase 3a: Outloud events, bookings, tickets, payments (bank transfer for now), saved items, settings.
-- Plan: docs/phase-3-plan.md. Booking, payment and check-in changes only happen through the
-- functions below; the browser can read its own rows but never write them directly.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- types

create type public.event_type as enum ('public_show', 'workshop', 'private_session');
create type public.pub_status as enum ('draft', 'published');
create type public.booking_status as enum ('reserved', 'confirmed', 'cancelled', 'expired', 'refunded');
create type public.payment_status as enum ('pending', 'paid', 'cancelled', 'expired', 'refunded');

-- ---------------------------------------------------------------- helpers

-- Unambiguous random code (no 0/O/1/I/L).
create or replace function public.random_code(len int)
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  b bytea := extensions.gen_random_bytes(len);
  r text := '';
begin
  for i in 0 .. len - 1 loop
    r := r || substr(alphabet, (get_byte(b, i) % 31) + 1, 1);
  end loop;
  return r;
end $$;
revoke all on function public.random_code(int) from public;

-- Pay-by deadline: 48 hours, or 24 hours before the show if that is sooner.
-- If that moment has (almost) passed, allow up to 2 hours but never past the start.
create or replace function public.payment_deadline(p_starts_at timestamptz, p_now timestamptz default now())
returns timestamptz language sql immutable set search_path = '' as $$
  select case
    when least(p_now + interval '48 hours', p_starts_at - interval '24 hours') > p_now + interval '1 hour'
      then least(p_now + interval '48 hours', p_starts_at - interval '24 hours')
    else least(p_now + interval '2 hours', p_starts_at)
  end;
$$;
grant execute on function public.payment_deadline(timestamptz, timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------- events

create table public.events (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title          text not null check (char_length(title) between 3 and 140),
  type           public.event_type not null default 'public_show',
  starts_at      timestamptz,
  venue          text check (char_length(venue) <= 160),
  capacity       int not null default 0 check (capacity between 0 and 10000),
  price_piasters int check (price_piasters >= 0),
  hosts          text check (char_length(hosts) <= 160),
  guest          text check (char_length(guest) <= 160),
  description    text check (char_length(description) <= 4000),
  banner         text not null default 'Stage',
  status         public.pub_status not null default 'draft',
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint dated_unless_private check (type = 'private_session' or starts_at is not null)
);
create index events_starts_idx on public.events (status, starts_at);
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- bookings, tickets, payments

create table public.bookings (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events (id) on delete restrict,
  member_id       uuid not null references auth.users (id) on delete restrict,
  seats           smallint not null check (seats between 1 and 2),
  amount_piasters int not null check (amount_piasters >= 0),
  status          public.booking_status not null default 'reserved',
  pay_reference   text not null unique,
  hold_expires_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  closed_at       timestamptz,
  closed_by       uuid references auth.users (id) on delete set null
);
create index bookings_event_idx on public.bookings (event_id, status);
create index bookings_member_idx on public.bookings (member_id);
-- One active booking per member per event.
create unique index bookings_one_active on public.bookings (event_id, member_id)
  where status in ('reserved', 'confirmed');
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

create table public.tickets (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null unique references public.bookings (id) on delete cascade,
  code          text not null unique,
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users (id) on delete set null
);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references public.bookings (id) on delete restrict,
  method          text not null check (method in ('bank_transfer', 'card', 'wallet', 'fawry', 'cash')),
  amount_piasters int not null check (amount_piasters >= 0),
  status          public.payment_status not null default 'pending',
  reference       text,
  marked_by       uuid references auth.users (id) on delete set null,
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id);
create index payments_status_idx on public.payments (status, created_at desc);

-- ---------------------------------------------------------------- saved items, settings

create table public.saved_items (
  member_id  uuid not null references auth.users (id) on delete cascade,
  item_type  text not null check (item_type in ('blog', 'resource', 'post', 'event')),
  item_id    text not null check (char_length(item_id) <= 100),
  created_at timestamptz not null default now(),
  primary key (member_id, item_type, item_id)
);

create table public.site_settings (
  key        text primary key check (key in ('bank_details', 'refund_policy')),
  value      text not null default '' check (char_length(value) <= 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.site_settings (key, value) values ('bank_details', ''), ('refund_policy', '');

-- ---------------------------------------------------------------- availability

-- Seats counted as taken: confirmed, plus reservations whose hold hasn't run out.
create or replace function public.seats_taken(p_event uuid)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(sum(seats), 0)::int from public.bookings
  where event_id = p_event
    and (status = 'confirmed' or (status = 'reserved' and hold_expires_at > now()));
$$;

create or replace function public.event_seats_left(p_event uuid)
returns int language sql stable security definer set search_path = '' as $$
  select greatest(e.capacity - public.seats_taken(e.id), 0)
  from public.events e
  where e.id = p_event and (e.status = 'published' or public.is_admin());
$$;

-- Mark lapsed reservations as expired (also run lazily before every booking).
create or replace function public.expire_holds(p_event uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with x as (
    update public.bookings set status = 'expired', closed_at = now()
    where status = 'reserved' and hold_expires_at <= now() and (p_event is null or event_id = p_event)
    returning id
  ), p as (
    update public.payments set status = 'expired'
    where status = 'pending' and booking_id in (select id from x)
  )
  select count(*) into n from x;
  return n;
end $$;

-- ---------------------------------------------------------------- member actions

create or replace function public.book_event(p_event uuid, p_seats int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  e public.events%rowtype;
  taken int;
  deadline timestamptz;
  b_id uuid;
  ref text;
  code text;
begin
  if me is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_seats is null or p_seats < 1 or p_seats > 2 then raise exception 'seat_limit' using errcode = '22023'; end if;

  -- Lock the event row so two bookings for the same event run one after the other.
  select * into e from public.events where id = p_event for update;
  if not found or e.status <> 'published' then raise exception 'not_found' using errcode = 'P0002'; end if;
  if e.type = 'private_session' then raise exception 'request_only' using errcode = '22023'; end if;
  if e.starts_at <= now() then raise exception 'event_started' using errcode = '22023'; end if;
  if e.price_piasters is null then raise exception 'not_open' using errcode = '22023'; end if;

  perform public.expire_holds(p_event);
  if exists (select 1 from public.bookings where event_id = p_event and member_id = me and status in ('reserved', 'confirmed')) then
    raise exception 'already_booked' using errcode = '23505';
  end if;

  taken := public.seats_taken(p_event);
  if taken + p_seats > e.capacity then raise exception 'sold_out' using errcode = '22023'; end if;

  deadline := public.payment_deadline(e.starts_at);
  ref := 'VWB-' || public.random_code(6);
  code := 'VW-' || public.random_code(4) || '-' || public.random_code(4);

  insert into public.bookings (event_id, member_id, seats, amount_piasters, status, pay_reference, hold_expires_at)
  values (p_event, me, p_seats, p_seats * e.price_piasters,
          case when e.price_piasters = 0 then 'confirmed'::public.booking_status else 'reserved' end,
          ref, case when e.price_piasters = 0 then null else deadline end)
  returning id into b_id;

  insert into public.payments (booking_id, method, amount_piasters, status, reference, paid_at)
  values (b_id, 'bank_transfer', p_seats * e.price_piasters,
          case when e.price_piasters = 0 then 'paid'::public.payment_status else 'pending' end,
          ref, case when e.price_piasters = 0 then now() end);

  insert into public.tickets (booking_id, code) values (b_id, code);

  return jsonb_build_object(
    'booking_id', b_id, 'code', code, 'pay_reference', ref, 'seats', p_seats,
    'amount_piasters', p_seats * e.price_piasters,
    'hold_expires_at', case when e.price_piasters = 0 then null else deadline end,
    'status', case when e.price_piasters = 0 then 'confirmed' else 'reserved' end
  );
end $$;

-- Members can cancel their own unpaid reservation. Paid bookings are cancelled by admins (refund policy).
create or replace function public.cancel_my_booking(p_booking uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  update public.bookings set status = 'cancelled', closed_at = now(), closed_by = me
  where id = p_booking and member_id = me and status = 'reserved';
  if not found then raise exception 'not_cancellable' using errcode = '22023'; end if;
  update public.payments set status = 'cancelled' where booking_id = p_booking and status = 'pending';
end $$;

-- Payment instructions shown to members with a reservation.
create or replace function public.payment_instructions()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_object_agg(key, value) from public.site_settings
  where key in ('bank_details', 'refund_policy') and auth.uid() is not null;
$$;

-- ---------------------------------------------------------------- admin actions (require is_admin)

create or replace function public.admin_mark_paid(p_booking uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; e public.events%rowtype;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if b.status = 'confirmed' then return; end if;

  if b.status = 'expired' then
    -- A late payment: only accept if the seats are still free.
    select * into e from public.events where id = b.event_id for update;
    if public.seats_taken(b.event_id) + b.seats > e.capacity then raise exception 'sold_out' using errcode = '22023'; end if;
    if exists (select 1 from public.bookings where event_id = b.event_id and member_id = b.member_id
               and status in ('reserved', 'confirmed') and id <> b.id) then
      raise exception 'already_booked' using errcode = '23505';
    end if;
  elsif b.status <> 'reserved' then
    raise exception 'not_payable' using errcode = '22023';
  end if;

  update public.bookings set status = 'confirmed', hold_expires_at = null, closed_at = null where id = p_booking;
  update public.payments set status = 'paid', paid_at = now(), marked_by = auth.uid()
  where booking_id = p_booking and status in ('pending', 'expired');
  insert into public.audit_log (actor, action, entity, entity_id, after)
  values (auth.uid(), 'booking.mark_paid', 'bookings', p_booking::text, jsonb_build_object('previous', b.status));
end $$;

create or replace function public.admin_cancel_booking(p_booking uuid, p_refund boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; next_status public.booking_status;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if b.status not in ('reserved', 'confirmed') then raise exception 'not_cancellable' using errcode = '22023'; end if;

  next_status := case when p_refund and b.status = 'confirmed' then 'refunded' else 'cancelled' end;
  update public.bookings set status = next_status, closed_at = now(), closed_by = auth.uid() where id = p_booking;
  update public.payments set status = case when status = 'paid' and p_refund then 'refunded'::public.payment_status
                                            when status = 'pending' then 'cancelled'::public.payment_status
                                            else status end
  where booking_id = p_booking;
  insert into public.audit_log (actor, action, entity, entity_id, before, after)
  values (auth.uid(), 'booking.' || next_status, 'bookings', p_booking::text,
          jsonb_build_object('status', b.status), jsonb_build_object('status', next_status, 'refund', p_refund));
end $$;

-- Door check-in by ticket code.
create or replace function public.admin_check_in(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.tickets%rowtype; b public.bookings%rowtype; e public.events%rowtype; who text;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into t from public.tickets where code = upper(trim(p_code)) for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  select * into b from public.bookings where id = t.booking_id;
  select * into e from public.events where id = b.event_id;
  select coalesce(p.full_name, u.email) into who
    from auth.users u left join public.profiles p on p.id = u.id where u.id = b.member_id;

  if b.status <> 'confirmed' then
    return jsonb_build_object('result', case when b.status = 'reserved' then 'unpaid' else b.status::text end,
      'name', who, 'seats', b.seats, 'event', e.title, 'code', t.code);
  end if;
  if t.checked_in_at is not null then
    return jsonb_build_object('result', 'already', 'name', who, 'seats', b.seats, 'event', e.title,
      'code', t.code, 'checked_in_at', t.checked_in_at);
  end if;
  update public.tickets set checked_in_at = now(), checked_in_by = auth.uid() where id = t.id;
  insert into public.audit_log (actor, action, entity, entity_id) values (auth.uid(), 'ticket.check_in', 'tickets', t.code);
  return jsonb_build_object('result', 'ok', 'name', who, 'seats', b.seats, 'event', e.title, 'code', t.code);
end $$;

-- ---------------------------------------------------------------- row level security

alter table public.events        enable row level security;
alter table public.bookings      enable row level security;
alter table public.tickets       enable row level security;
alter table public.payments      enable row level security;
alter table public.saved_items   enable row level security;
alter table public.site_settings enable row level security;

create policy "Published events are public; admins see all" on public.events
  for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "Admins create events" on public.events
  for insert to authenticated with check (public.is_admin());
create policy "Admins edit events" on public.events
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete events" on public.events
  for delete to authenticated using (public.is_admin());

create policy "Members see their bookings; admins see all" on public.bookings
  for select to authenticated using (member_id = auth.uid() or public.is_admin());
create policy "Members see their tickets; admins see all" on public.tickets
  for select to authenticated using (
    public.is_admin() or exists (select 1 from public.bookings b where b.id = booking_id and b.member_id = auth.uid()));
create policy "Members see their payments; admins see all" on public.payments
  for select to authenticated using (
    public.is_admin() or exists (select 1 from public.bookings b where b.id = booking_id and b.member_id = auth.uid()));

create policy "Members manage their saved items" on public.saved_items
  for all to authenticated using (member_id = auth.uid()) with check (member_id = auth.uid());

create policy "Admins read settings" on public.site_settings
  for select to authenticated using (public.is_admin());
create policy "Admins edit settings" on public.site_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- grants (tables are private by default)

revoke all on public.events, public.bookings, public.tickets, public.payments, public.saved_items, public.site_settings
  from anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
grant select on public.bookings, public.tickets, public.payments to authenticated;
grant select, insert, delete on public.saved_items to authenticated;
grant select, update on public.site_settings to authenticated;
grant all on public.events, public.bookings, public.tickets, public.payments, public.saved_items, public.site_settings
  to service_role;

revoke all on function public.seats_taken(uuid), public.event_seats_left(uuid), public.expire_holds(uuid),
  public.book_event(uuid, int), public.cancel_my_booking(uuid), public.payment_instructions(),
  public.admin_mark_paid(uuid), public.admin_cancel_booking(uuid, boolean), public.admin_check_in(text) from public;
grant execute on function public.event_seats_left(uuid) to anon, authenticated;
grant execute on function public.book_event(uuid, int), public.cancel_my_booking(uuid), public.payment_instructions(),
  public.admin_mark_paid(uuid), public.admin_cancel_booking(uuid, boolean), public.admin_check_in(text) to authenticated;
-- Expiring lapsed holds is harmless, so any signed-in session may trigger the cleanup.
grant execute on function public.expire_holds(uuid) to authenticated, service_role;
grant execute on function public.seats_taken(uuid) to service_role;
