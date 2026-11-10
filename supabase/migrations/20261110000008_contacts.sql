-- Phase 7b: contacts the partners add, and private notes and tags on members and contacts.
-- Admins only. Plan: docs/phase-7b-plan.md.

create table public.contacts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  email      text check (email is null or (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone      text check (char_length(phone) <= 40),
  company    text check (char_length(company) <= 120),
  role       text check (char_length(role) <= 80),
  source     text not null default 'Added by admin' check (char_length(source) <= 60),
  tags       text[] not null default '{}' check (tags <@ array['Outloud', 'TVS', 'BRICKR', 'QuidQuo']::text[]),
  consent    text not null default 'Not asked yet' check (consent in ('Email, WhatsApp, push', 'Email, WhatsApp', 'Email', 'WhatsApp', 'Not asked yet')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index contacts_email_idx on public.contacts (lower(email)) where email is not null;
create trigger contacts_touch before update on public.contacts for each row execute function public.touch_updated_at();

-- One private note (and admin tags) per member or added contact.
create table public.contact_notes (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid unique references auth.users (id) on delete cascade,
  contact_id uuid unique references public.contacts (id) on delete cascade,
  note       text not null default '' check (char_length(note) <= 4000),
  tags       text[] not null default '{}' check (tags <@ array['Outloud', 'TVS', 'BRICKR', 'QuidQuo']::text[]),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  check ((member_id is null) <> (contact_id is null))
);
create trigger contact_notes_touch before update on public.contact_notes for each row execute function public.touch_updated_at();

alter table public.contacts enable row level security;
alter table public.contact_notes enable row level security;
create policy "Admins only: contacts" on public.contacts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins only: contact notes" on public.contact_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.contacts, public.contact_notes from anon, authenticated;
grant select, insert, update, delete on public.contacts, public.contact_notes to authenticated;
grant all on public.contacts, public.contact_notes to service_role;
