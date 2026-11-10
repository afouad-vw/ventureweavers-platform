-- Phase 5: home feed and announcements, Outloud digital content and blog, Library, topic suggestions,
-- publishing history. Access rules: docs/phase-5-plan.md.

-- ---------------------------------------------------------------- shared checks

create or replace function public.is_space(v text) returns boolean language sql immutable set search_path = '' as $$
  select v in ('House', 'Outloud', 'TVS', 'BRICKR', 'QuidQuo') $$;

-- A link is either a path inside the member app ("/outloud?tab=blog") or an https address.
create or replace function public.is_safe_link(v text) returns boolean language sql immutable set search_path = '' as $$
  select v is null or (char_length(v) <= 500 and (v ~ '^/[A-Za-z0-9/_?=&.#%-]*$' or v ~ '^https://[^\s<>"]+$') and v !~ '^//') $$;

-- Uploaded images for posts and blog banners (public, like event banners).
create or replace function public.is_content_image(v text) returns boolean language sql immutable set search_path = '' as $$
  select v is null or (char_length(v) <= 500 and v ~ '^https://[^ ]+/storage/v1/object/public/(content-images|event-banners)/[A-Za-z0-9/_.-]+$') $$;

revoke all on function public.is_space(text), public.is_safe_link(text), public.is_content_image(text) from public;
grant execute on function public.is_space(text), public.is_safe_link(text), public.is_content_image(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------- feed posts and announcements

create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  space         text not null default 'House' check (public.is_space(space)),
  kind          text not null default 'Update' check (char_length(kind) between 1 and 80),
  title         text not null check (char_length(title) between 3 and 160),
  body          text not null default '' check (char_length(body) <= 2000),
  image_url     text check (public.is_content_image(image_url)),
  banner        text check (banner is null or char_length(banner) <= 20),
  link_url      text check (public.is_safe_link(link_url)),
  link_label    text check (char_length(link_label) <= 40),
  pinned_until  timestamptz,
  status        public.pub_status not null default 'draft',
  published_at  timestamptz not null default now(),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index posts_feed_idx on public.posts (status, published_at desc);
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- Outloud digital content

create table public.content_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 3 and 160),
  series      text not null default 'The Question' check (char_length(series) between 1 and 60),
  format      text not null check (format in ('Short', 'Carousel', 'Reel', 'Episode')),
  platform    text not null check (platform in ('Instagram', 'TikTok', 'LinkedIn', 'YouTube')),
  url         text check (url is null or (char_length(url) <= 500 and url ~ '^https://[^\s<>"]+$')),
  publish_on  date not null default current_date,
  status      text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index content_items_idx on public.content_items (status, publish_on desc);
create trigger content_items_touch before update on public.content_items for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- blog

create table public.blog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title         text not null check (char_length(title) between 3 and 160),
  category      text not null default 'Article' check (category in ('Newsletter', 'Article', 'Founder notes')),
  author        text not null default 'Fouad & Karim' check (char_length(author) between 1 and 80),
  published_on  date not null default current_date,
  read_time     text not null default '5 min' check (char_length(read_time) <= 20),
  summary       text not null default '' check (char_length(summary) <= 400),
  body          text not null default '' check (char_length(body) <= 60000),
  banner        text not null default 'Pattern' check (char_length(banner) <= 20),
  banner_url    text check (public.is_content_image(banner_url)),
  tags          text[] not null default '{}' check (cardinality(tags) <= 8),
  status        public.pub_status not null default 'draft',
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index blog_posts_idx on public.blog_posts (status, published_on desc);
create trigger blog_posts_touch before update on public.blog_posts for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- Library

create table public.library_resources (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 3 and 160),
  kind         text not null check (kind in ('Report', 'Guide', 'Template', 'AI skill')),
  space        text not null default 'House' check (public.is_space(space)),
  access       text not null default 'all_members' check (access in ('all_members', 'tvs_learners', 'brickr_clients', 'quidquo_waitlist')),
  description  text not null default '' check (char_length(description) <= 600),
  -- Where the resource lives. Hidden from members' table reads; handed out by open_resource().
  file_path    text check (file_path is null or (char_length(file_path) <= 300 and file_path ~ '^[A-Za-z0-9/_.-]+$' and file_path !~ '\.\.')),
  file_name    text check (char_length(file_name) <= 200),
  file_size    bigint check (file_size is null or file_size between 1 and 20971520),
  link_url     text check (link_url is null or (char_length(link_url) <= 500 and link_url ~ '^https://[^\s<>"]+$')),
  ready        boolean generated always as (file_path is not null or link_url is not null) stored,
  status       public.pub_status not null default 'draft',
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (file_path is null or link_url is null)
);
create index library_resources_idx on public.library_resources (status, created_at desc);
create trigger library_resources_touch before update on public.library_resources for each row execute function public.touch_updated_at();

-- Which access levels a member holds. Only "All members" exists today; the learner, client and waitlist
-- levels switch on with TVS (Phase 6), BRICKR and QuidQuo (Phase 7).
create or replace function public.my_access_levels() returns text[] language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then '{}'::text[] else array['all_members'] end $$;

-- Hands out where a resource lives, only to members whose level allows it (and to admins).
-- The server turns a file path into a download link that expires after a few minutes.
create or replace function public.open_resource(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r public.library_resources;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into r from public.library_resources where id = p_id;
  if not found or (r.status <> 'published' and not public.is_admin()) then raise exception 'not_found'; end if;
  if not public.is_admin() and not (r.access = any (public.my_access_levels())) then raise exception 'locked'; end if;
  if r.file_path is null and r.link_url is null then raise exception 'no_file'; end if;
  return jsonb_build_object('file_path', r.file_path, 'file_name', r.file_name, 'link_url', r.link_url);
end $$;

-- Admin editor: the hidden columns for every resource.
create or replace function public.admin_resource_targets()
returns table (id uuid, file_path text, file_name text, file_size bigint, link_url text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select r.id, r.file_path, r.file_name, r.file_size, r.link_url from public.library_resources r;
end $$;

-- Private storage for Library files: no browser access at all. Uploads go through short-lived signed
-- upload links made on the server for admins; downloads through short-lived signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library-files', 'library-files', false, 20971520, array[
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'application/x-zip-compressed'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Public images for feed posts and blog banners.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-images', 'content-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins upload content images" on storage.objects
  for insert to authenticated with check (bucket_id = 'content-images' and public.is_admin());
create policy "Admins replace content images" on storage.objects
  for update to authenticated using (bucket_id = 'content-images' and public.is_admin()) with check (bucket_id = 'content-images' and public.is_admin());
create policy "Admins delete content images" on storage.objects
  for delete to authenticated using (bucket_id = 'content-images' and public.is_admin());

-- ---------------------------------------------------------------- topic suggestions

create table public.topic_suggestions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text        text not null check (char_length(btrim(text)) between 5 and 500),
  status      text not null default 'new' check (status in ('new', 'picked', 'archived')),
  created_at  timestamptz not null default now()
);
create index topic_suggestions_idx on public.topic_suggestions (status, created_at desc);

-- At most 5 suggestions per member per day, to keep the list useful.
create or replace function public.topic_suggestions_limit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.topic_suggestions
      where member_id = new.member_id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'topic_limit';
  end if;
  return new;
end $$;
create trigger topic_suggestions_limit before insert on public.topic_suggestions
  for each row execute function public.topic_suggestions_limit();

-- ---------------------------------------------------------------- publishing history

create table public.publish_log (
  id             bigint generated always as identity primary key,
  post_id        uuid references public.posts (id) on delete set null,
  title          text not null check (char_length(title) <= 160),
  channels       text[] not null check (channels <@ array['feed', 'email']::text[] and cardinality(channels) >= 1),
  audience       text not null default 'All members' check (char_length(audience) <= 60),
  emails_sent    int not null default 0 check (emails_sent >= 0),
  emails_failed  int not null default 0 check (emails_failed >= 0),
  sent_by        uuid references auth.users (id) on delete set null,
  sent_at        timestamptz not null default now()
);
create index publish_log_idx on public.publish_log (sent_at desc);

-- ---------------------------------------------------------------- row level security

alter table public.posts             enable row level security;
alter table public.content_items     enable row level security;
alter table public.blog_posts        enable row level security;
alter table public.library_resources enable row level security;
alter table public.topic_suggestions enable row level security;
alter table public.publish_log       enable row level security;

-- Feed: signed-in members see what's published and due; admins see everything.
create policy "Members read the feed; admins read all" on public.posts
  for select to authenticated using ((status = 'published' and published_at <= now()) or public.is_admin());
-- Digital content and blog are public once published (scheduled content shows as "Coming").
create policy "Published content is public; admins see all" on public.content_items
  for select to anon, authenticated using (status in ('published', 'scheduled') or public.is_admin());
create policy "Published blog posts are public; admins see all" on public.blog_posts
  for select to anon, authenticated using (status = 'published' or public.is_admin());
-- Library list: signed-in members see published resources (locked ones too, marked as locked).
create policy "Members see published resources; admins see all" on public.library_resources
  for select to authenticated using (status = 'published' or public.is_admin());

create policy "Admins create posts" on public.posts for insert to authenticated with check (public.is_admin());
create policy "Admins edit posts" on public.posts for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete posts" on public.posts for delete to authenticated using (public.is_admin());
create policy "Admins create content" on public.content_items for insert to authenticated with check (public.is_admin());
create policy "Admins edit content" on public.content_items for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete content" on public.content_items for delete to authenticated using (public.is_admin());
create policy "Admins create blog posts" on public.blog_posts for insert to authenticated with check (public.is_admin());
create policy "Admins edit blog posts" on public.blog_posts for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete blog posts" on public.blog_posts for delete to authenticated using (public.is_admin());
create policy "Admins create resources" on public.library_resources for insert to authenticated with check (public.is_admin());
create policy "Admins edit resources" on public.library_resources for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete resources" on public.library_resources for delete to authenticated using (public.is_admin());

create policy "Members send their own topics" on public.topic_suggestions
  for insert to authenticated with check (member_id = auth.uid() and status = 'new');
create policy "Members see their own topics; admins see all" on public.topic_suggestions
  for select to authenticated using (member_id = auth.uid() or public.is_admin());
create policy "Admins triage topics" on public.topic_suggestions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete topics" on public.topic_suggestions
  for delete to authenticated using (public.is_admin());

create policy "Admins read the publishing history" on public.publish_log
  for select to authenticated using (public.is_admin());
create policy "Admins record what they publish" on public.publish_log
  for insert to authenticated with check (public.is_admin() and sent_by = auth.uid());

-- ---------------------------------------------------------------- grants (tables are private by default)

revoke all on public.posts, public.content_items, public.blog_posts, public.library_resources,
  public.topic_suggestions, public.publish_log from anon, authenticated;

grant select on public.content_items, public.blog_posts to anon, authenticated;
grant select on public.posts to authenticated;
-- Members can list resources but not read where they live (file_path, file_name, file_size, link_url).
grant select (id, title, kind, space, access, description, ready, status, created_at, updated_at) on public.library_resources to authenticated;
grant insert, update, delete on public.posts, public.content_items, public.blog_posts, public.library_resources to authenticated;
grant select, delete on public.topic_suggestions to authenticated;
grant insert (text) on public.topic_suggestions to authenticated;
grant update (status) on public.topic_suggestions to authenticated;
grant select, insert on public.publish_log to authenticated;
grant all on public.posts, public.content_items, public.blog_posts, public.library_resources,
  public.topic_suggestions, public.publish_log to service_role;

revoke all on function public.my_access_levels(), public.open_resource(uuid), public.admin_resource_targets(),
  public.topic_suggestions_limit() from public;
grant execute on function public.my_access_levels(), public.open_resource(uuid), public.admin_resource_targets() to authenticated;
