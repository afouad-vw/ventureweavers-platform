-- Eureka (2026-11-26, asked by Ahmed): the QuidQuo space becomes Eureka, VentureWeavers' products lab, with two products:
-- QuidQuo (AI for capital formation) and Handlr (an AI executive assistant for professionals and businesses).
-- Each product has its own stages, build log and waiting list, so the QuidQuo tables gain a product column.
-- Handlr starts with the same stages and progress as QuidQuo (copied once; they move independently after this).
-- Waiting-list roles depend on the product. Library access "QuidQuo waitlist" stays QuidQuo's list only.

alter table public.qq_stages add column product text not null default 'quidquo' check (product in ('quidquo', 'handlr'));
alter table public.qq_log add column product text not null default 'quidquo' check (product in ('quidquo', 'handlr'));
create index qq_stages_product_idx on public.qq_stages (product, position);
create index qq_log_product_idx on public.qq_log (product, status, entry_date desc);

alter table public.waitlist add column product text not null default 'quidquo' check (product in ('quidquo', 'handlr'));
-- One entry per member per product (it was one per member).
alter table public.waitlist drop constraint waitlist_member_id_key;
alter table public.waitlist add constraint waitlist_member_product_key unique (member_id, product);
drop index public.waitlist_email_idx;
create unique index waitlist_email_idx on public.waitlist (product, lower(email)) where email is not null;
alter table public.waitlist drop constraint waitlist_role_check;
alter table public.waitlist add constraint waitlist_role_check check (
  (product = 'quidquo' and role in ('Founder raising capital', 'Investor or angel', 'Ecosystem partner'))
  or (product = 'handlr' and role in ('Professional', 'Business owner or team', 'Executive assistant or operations')));

-- Handlr starts where QuidQuo is today.
insert into public.qq_stages (position, name, description, progress, product)
select position, name, description, progress, 'handlr' from public.qq_stages where product = 'quidquo';

-- Join (or update) a product's waiting list, optionally through someone's invite code for that product.
drop function public.join_waitlist(text, boolean, text);
create function public.join_waitlist(p_role text, p_feedback boolean, p_ref text default null, p_product text default 'quidquo') returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); inviter uuid; code text;
begin
  if me is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_product not in ('quidquo', 'handlr') then raise exception 'bad_product' using errcode = '22023'; end if;
  if not ((p_product = 'quidquo' and p_role in ('Founder raising capital', 'Investor or angel', 'Ecosystem partner'))
       or (p_product = 'handlr' and p_role in ('Professional', 'Business owner or team', 'Executive assistant or operations'))) then
    raise exception 'bad_role' using errcode = '22023';
  end if;
  if p_ref is not null and p_ref ~ '^[2-9A-Z]{8}$' then
    select id into inviter from public.waitlist where invite_code = p_ref and product = p_product and member_id is distinct from me;
  end if;
  insert into public.waitlist (member_id, role, feedback_calls, invited_by, product)
  values (me, p_role, coalesce(p_feedback, true), inviter, p_product)
  on conflict (member_id, product) do update set role = excluded.role, feedback_calls = excluded.feedback_calls
  returning invite_code into code;
  return code;
end $$;
revoke all on function public.join_waitlist(text, boolean, text, text) from public;
grant execute on function public.join_waitlist(text, boolean, text, text) to authenticated;

create or replace function public.my_access_levels() returns text[] language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then '{}'::text[]
    else array['all_members']
      || case when exists (select 1 from public.enrolments en where en.member_id = auth.uid() and en.status = 'confirmed') then array['tvs_learners'] else '{}'::text[] end
      || case when exists (select 1 from public.requests r where r.member_id = auth.uid() and r.status = 'won') then array['brickr_clients'] else '{}'::text[] end
      || case when exists (select 1 from public.waitlist w where w.member_id = auth.uid() and w.product = 'quidquo') then array['quidquo_waitlist'] else '{}'::text[] end
  end $$;
