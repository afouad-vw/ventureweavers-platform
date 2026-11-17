-- Approved 2026-11-17: members share news about their business for the VW Newsletter or VW Notes.
-- The team reviews it in Requests, edits it as a blog post, then publishes it or declines it with a note.
-- Viewing needs Requests or Content access; editing, publishing and declining need Content (manage).

create table public.news_submissions (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  business_name  text not null check (char_length(business_name) between 1 and 120),
  news_type      text not null check (news_type in ('Funding round', 'Launch', 'Partnership', 'New hire', 'Milestone or award', 'Event', 'Other')),
  headline       text not null check (char_length(headline) between 3 and 160),
  news_date      date not null,
  summary        text not null check (char_length(summary) between 1 and 300),
  details        text not null check (char_length(details) between 1 and 3000),
  link           text check (link is null or (char_length(link) <= 500 and link ~ '^https://[^\s<>"]+$')),
  image_url      text check (public.is_content_image(image_url)),
  preferred      text not null default 'Either' check (preferred in ('Newsletter', 'VW Notes', 'Either')),
  contact_name   text not null check (char_length(contact_name) between 1 and 120),
  contact_email  text not null check (char_length(contact_email) <= 200 and contact_email ~ '^[^@\s]+@[^@\s]+$'),
  contact_phone  text check (contact_phone is null or char_length(contact_phone) <= 40),
  consent        boolean not null check (consent),
  status         text not null default 'submitted' check (status in ('submitted', 'in_review', 'published', 'declined')),
  decline_note   text check (decline_note is null or char_length(decline_note) <= 500),
  blog_post_id   uuid references public.blog_posts (id) on delete set null,
  reviewed_by    uuid references auth.users (id) on delete set null,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index news_submissions_member_idx on public.news_submissions (member_id, created_at desc);
create index news_submissions_status_idx on public.news_submissions (status, created_at desc);
create trigger news_submissions_touch before update on public.news_submissions for each row execute function public.touch_updated_at();

-- Staff accounts don't share member news (row level security can't read admin_users directly).
create or replace function public.is_staff_account() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid()) $$;
revoke all on function public.is_staff_account() from public;
grant execute on function public.is_staff_account() to authenticated;

alter table public.news_submissions enable row level security;
create policy "Members see their news; Requests and Content viewers see all" on public.news_submissions
  for select to authenticated using (member_id = auth.uid() or public.has_any_perm('{requests.view,content.view}'::text[]));
create policy "Members share news" on public.news_submissions
  for insert to authenticated with check (
    member_id = auth.uid() and status = 'submitted' and decline_note is null and blog_post_id is null and reviewed_by is null
    and not public.is_staff_account());
grant select, insert on public.news_submissions to authenticated;
-- Reviews go through the functions below only.

-- Up to 5 submissions a day per member.
create or replace function public.news_rate_limit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.news_submissions where member_id = new.member_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'too_many_submissions' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger news_rate_limit before insert on public.news_submissions for each row execute function public.news_rate_limit();

-- Save the team's edit as a blog post (draft, or published), linked to the submission.
-- p_section is 'Newsletter' or 'VW Notes' (stored as the 'Founder notes' category, shown as VW Notes).
create or replace function public.admin_news_save(
  p_id uuid, p_title text, p_summary text, p_body text, p_section text, p_author text, p_banner_url text, p_publish boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  s public.news_submissions;
  post uuid;
  slug text;
  cat text := case p_section when 'Newsletter' then 'Newsletter' when 'VW Notes' then 'Founder notes' end;
begin
  if not public.has_any_perm('{content.manage}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  if cat is null then raise exception 'bad_section' using errcode = '22023'; end if;
  select * into s from public.news_submissions where id = p_id for update;
  if s.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if s.status = 'declined' then raise exception 'declined' using errcode = '22023'; end if;
  post := s.blog_post_id;
  if post is null or not exists (select 1 from public.blog_posts where id = post) then
    slug := left(trim(both '-' from regexp_replace(lower(coalesce(p_title, '')), '[^a-z0-9]+', '-', 'g')), 100);
    slug := case when slug = '' then 'member-news' else slug end || '-' || left(replace(p_id::text, '-', ''), 6);
    insert into public.blog_posts (slug, title, category, author, summary, body, banner, banner_url, tags, status, created_by, read_time)
    values (slug, p_title, cat, coalesce(nullif(trim(p_author), ''), s.business_name), coalesce(p_summary, ''), coalesce(p_body, ''),
            'Pattern', p_banner_url, array['Member news'], 'draft', me, '2 min')
    returning id into post;
  else
    update public.blog_posts set title = p_title, category = cat, author = coalesce(nullif(trim(p_author), ''), s.business_name),
      summary = coalesce(p_summary, ''), body = coalesce(p_body, ''), banner_url = p_banner_url
    where id = post;
  end if;
  if p_publish then
    update public.blog_posts set status = 'published', published_on = current_date where id = post;
  end if;
  update public.news_submissions set
    blog_post_id = post,
    status = case when p_publish then 'published' when status = 'published' then 'published' else 'in_review' end,
    reviewed_by = me, reviewed_at = now()
  where id = p_id;
  if p_publish and s.status <> 'published' then
    select b.slug into slug from public.blog_posts b where b.id = post;
    perform public.notify(s.member_id, 'Your news is published: ' || left(p_title, 120), '/outloud/blog/' || slug);
  end if;
  return jsonb_build_object('post_id', post, 'published', p_publish or s.status = 'published');
end $$;

create or replace function public.admin_news_decline(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.news_submissions;
begin
  if not public.has_any_perm('{content.manage}'::text[]) then raise exception 'not_admin' using errcode = '42501'; end if;
  select * into s from public.news_submissions where id = p_id for update;
  if s.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if s.status = 'published' then raise exception 'published' using errcode = '22023'; end if;
  update public.news_submissions set status = 'declined', decline_note = nullif(left(trim(coalesce(p_note, '')), 500), ''),
    reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
  -- A draft made from it is no longer needed.
  delete from public.blog_posts where id = s.blog_post_id and status = 'draft';
  perform public.notify(s.member_id, 'We won''t publish "' || left(s.headline, 80) || '" this time. See My space for our note.', '/my-space?tab=news');
end $$;

revoke all on function public.admin_news_save(uuid, text, text, text, text, text, text, boolean), public.admin_news_decline(uuid, text) from public;
grant execute on function public.admin_news_save(uuid, text, text, text, text, text, text, boolean), public.admin_news_decline(uuid, text) to authenticated;
