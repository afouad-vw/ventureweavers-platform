-- Phase 19d (approved 2026-11-24): filters for Networking › Members. Plan: docs/phase-19-plan.md.
-- Same people and columns as member_directory (admins, suspended members, blocks and yourself left out), plus filters by
-- Ecosystem Role, country, business type, venture stage, Public/Private and "follows you", and a sort (name or newest).
-- Country and businesses are already shown on every member tile, so filtering on them reveals nothing new.
-- Communities and discussions are filtered in the app from list_communities / list_discussions (they return every field needed).

create or replace function public.member_search(
  p_q text default null, p_role text default null, p_country text default null, p_business_type text default null, p_stage text default null,
  p_visibility text default null, p_follows_me boolean default false, p_sort text default 'name', p_limit int default 90, p_offset int default 0
) returns table (id uuid, name text, avatar_url text, roles text[], country text, visibility text, follow_state text, follows_me boolean, business text, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(nullif(btrim(p.full_name), ''), 'Member'), p.avatar_url, p.roles, p.country, p.visibility,
         public.blong_follow_state(auth.uid(), p.id),
         exists (select 1 from public.follows f where f.follower = p.id and f.followee = auth.uid() and f.status = 'accepted'),
         (select mb.name from public.member_businesses mb where mb.member_id = p.id order by mb.position limit 1),
         p.created_at
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and p.onboarded_at is not null
    and public.blong_member(p.id)
    and not public.blong_blocked(auth.uid(), p.id)
    and (p_role is null or p_role = any (p.roles))
    and (p_country is null or p.country = p_country)
    and (p_visibility is null or p.visibility = p_visibility)
    and (p_business_type is null or exists (select 1 from public.member_businesses mb where mb.member_id = p.id and mb.type = p_business_type))
    and (p_stage is null or exists (select 1 from public.member_businesses mb where mb.member_id = p.id and mb.stage = p_stage))
    and (not coalesce(p_follows_me, false) or exists (select 1 from public.follows f where f.follower = p.id and f.followee = auth.uid() and f.status = 'accepted'))
    and (coalesce(btrim(p_q), '') = '' or p.full_name ilike '%' || btrim(p_q) || '%'
         or exists (select 1 from public.member_businesses mb where mb.member_id = p.id and mb.name ilike '%' || btrim(p_q) || '%'))
  order by case when p_sort = 'newest' then p.created_at end desc nulls last, p.full_name nulls last, p.id
  limit least(greatest(coalesce(p_limit, 90), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Countries members chose, for the filter list (only countries with at least one member in the directory).
create or replace function public.member_countries() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct p.country order by p.country), '{}')
  from public.profiles p
  where auth.uid() is not null and p.country is not null and p.onboarded_at is not null and public.blong_member(p.id);
$$;

revoke all on function public.member_search(text, text, text, text, text, text, boolean, text, int, int), public.member_countries() from public;
grant execute on function public.member_search(text, text, text, text, text, text, boolean, text, int, int), public.member_countries() to authenticated;
