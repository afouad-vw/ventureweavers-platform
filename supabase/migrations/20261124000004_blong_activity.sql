-- Phase 18d (approved 2026-11-24): BLong VW activity and the feed. Plan: docs/phase-18-plan.md.
-- What a member does on the platform, shown on their page and in their followers' feed, as far as their
-- privacy allows (Public, or an accepted follower) and only the kinds they chose to show:
--   events       shows and masterclasses they have a confirmed seat for (public, published events only)
--   programs     programs they're enrolled in (confirmed; public programs only)
--   communities  communities and discussions they joined or started (only ones the viewer could find)
--   posts        their business news published on the blog
-- Never: payments, requests to the team, client projects, private (invited-only) items, email or phone.

create or replace function public.member_activity(p_id uuid, p_limit int default 30)
returns table (kind text, verb text, title text, href text, at timestamptz, starts_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as uid),
  shown as (
    select p.show_activity as kinds from public.profiles p, me
    where p.id = p_id and me.uid is not null and public.blong_can_see(me.uid, p_id)
  ),
  rows as (
    -- Shows and masterclasses
    select 'events'::text as kind,
           case when e.type = 'masterclass' then (case when e.starts_at is null or e.starts_at > now() then 'Booked a masterclass' else 'Attended a masterclass' end)
                else (case when e.starts_at is null or e.starts_at > now() then 'Going to' else 'Went to' end) end as verb,
           e.title, case when e.type = 'masterclass' then '/tvs/masterclasses/' else '/outloud/events/' end || e.slug as href,
           b.updated_at as at, e.starts_at
    from public.bookings b join public.events e on e.id = b.event_id
    where b.member_id = p_id and b.status = 'confirmed'
      and e.status = 'published' and e.visibility = 'public' and e.type in ('public_show', 'masterclass', 'workshop')
    union all
    -- Programs
    select 'programs', 'Joined the program', pr.name, '/tvs/programs/' || pr.slug, coalesce(en.confirmed_at, en.offered_at), c.starts_on::timestamptz
    from public.enrolments en join public.cohorts c on c.id = en.cohort_id join public.programs pr on pr.id = c.program_id
    where en.member_id = p_id and en.status = 'confirmed' and pr.visibility = 'public' and pr.status <> 'draft'
    union all
    -- Communities the viewer can find (all active ones) whose members the viewer may see
    select 'communities', case when cm.role = 'owner' then 'Started the community' else 'Joined the community' end, co.name,
           '/blong/communities/' || co.slug, coalesce(cm.joined_at, cm.created_at), null
    from public.community_members cm join public.communities co on co.id = cm.community_id, me
    where cm.member_id = p_id and cm.status = 'active' and co.status = 'active'
      and (co.visibility = 'public' or public.cm_role(co.id, me.uid) is not null)
    union all
    -- Discussions the viewer can find and read
    select 'communities', case when dm.role = 'owner' then 'Started the discussion' else 'Joined the discussion' end, d.title,
           '/blong/discussions/' || d.slug, coalesce(dm.joined_at, dm.created_at), null
    from public.discussion_members dm join public.discussions d on d.id = dm.discussion_id, me
    where dm.member_id = p_id and dm.status = 'active' and d.status <> 'archived'
      and public.dr_can_read(d.id, me.uid)
    union all
    -- Business news published on the blog
    select 'posts', 'Shared news', bp.title, '/outloud/blog/' || bp.slug, coalesce(ns.reviewed_at, bp.created_at), null
    from public.news_submissions ns join public.blog_posts bp on bp.id = ns.blog_post_id
    where ns.member_id = p_id and ns.status = 'published' and bp.status = 'published' and bp.visibility = 'public'
  )
  select r.kind, r.verb, r.title, r.href, r.at, r.starts_at
  from rows r, shown s
  where r.kind = any (s.kinds)
  order by r.at desc nulls last
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- Updates from the people the member follows (accepted follows), newest first.
create or replace function public.blong_feed(p_limit int default 60)
returns table (member_id uuid, name text, avatar_url text, kind text, verb text, title text, href text, at timestamptz, starts_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(nullif(btrim(p.full_name), ''), 'Member'), p.avatar_url, a.kind, a.verb, a.title, a.href, a.at, a.starts_at
  from public.follows f
  join public.profiles p on p.id = f.followee
  cross join lateral public.member_activity(f.followee, 15) a
  where f.follower = auth.uid() and f.status = 'accepted' and public.blong_member(f.followee)
    and a.at > now() - interval '120 days'
  order by a.at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;

revoke all on function public.member_activity(uuid, int), public.blong_feed(int) from public;
grant execute on function public.member_activity(uuid, int), public.blong_feed(int) to authenticated;
