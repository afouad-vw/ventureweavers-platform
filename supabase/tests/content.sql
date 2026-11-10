-- Access tests for the feed, digital content, blog, Library, topics and publishing. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a5', 'admin5@test', '{"name":"Admin Five"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test', '{"name":"Member C1"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test', '{"name":"Member C2"}');
insert into public.admin_users (user_id, username, display_name) values ('00000000-0000-0000-0000-0000000000a5', 'admin.five', 'Admin Five');

insert into public.posts (id, space, kind, title, body, status, published_at, pinned_until) values
  ('20000000-0000-0000-0000-000000000001', 'Outloud', 'Update', 'Live post', 'Hello', 'published', now() - interval '1 hour', now() + interval '3 days'),
  ('20000000-0000-0000-0000-000000000002', 'TVS', 'Update', 'Draft post', '', 'draft', now(), null),
  ('20000000-0000-0000-0000-000000000003', 'BRICKR', 'Update', 'Scheduled post', '', 'published', now() + interval '1 day', null);
insert into public.content_items (title, format, platform, url, status) values
  ('Published short', 'Short', 'Instagram', 'https://instagram.com/p/1', 'published'),
  ('Scheduled episode', 'Episode', 'YouTube', null, 'scheduled'),
  ('Draft reel', 'Reel', 'TikTok', null, 'draft');
insert into public.blog_posts (slug, title, body, status) values
  ('live-post', 'Live blog post', '## Hi', 'published'),
  ('draft-post', 'Draft blog post', 'Secret', 'draft');
insert into public.library_resources (id, title, kind, access, file_path, file_name, file_size, link_url, status) values
  ('30000000-0000-0000-0000-000000000001', 'Open report', 'Report', 'all_members', '2026-11/a.pdf', 'report.pdf', 1000, null, 'published'),
  ('30000000-0000-0000-0000-000000000002', 'Learner template', 'Template', 'tvs_learners', '2026-11/b.pdf', 'b.pdf', 1000, null, 'published'),
  ('30000000-0000-0000-0000-000000000003', 'Draft guide', 'Guide', 'all_members', null, null, null, 'https://example.com/guide', 'draft'),
  ('30000000-0000-0000-0000-000000000004', 'Linked skill', 'AI skill', 'all_members', null, null, null, 'https://example.com/skill', 'published'),
  ('30000000-0000-0000-0000-000000000005', 'Coming soon', 'Guide', 'all_members', null, null, null, null, 'published');

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', label; end if;
  raise notice 'ok - %', label;
end $$;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated;

create function pg_temp.expect_error(stmt text, code_like text, label text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % (no error)', label;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlerrm not like code_like then raise exception 'FAIL: % (got %)', label, sqlerrm; end if;
  raise notice 'ok - %', label;
end $$;
grant execute on function pg_temp.expect_error(text, text, text) to anon, authenticated;

create function pg_temp.as_user(uid text, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'aal', aal, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(text, text) to anon, authenticated;

-- link and image checks
select pg_temp.check(public.is_safe_link('/outloud?tab=blog'), 'app path is a safe link');
select pg_temp.check(public.is_safe_link('https://instagram.com/x'), 'https is a safe link');
select pg_temp.check(not public.is_safe_link('javascript:alert(1)'), 'javascript: is refused');
select pg_temp.check(not public.is_safe_link('//evil.example'), 'protocol-relative is refused');
select pg_temp.check(not public.is_safe_link('http://insecure.example'), 'plain http is refused');
select pg_temp.expect_error($$insert into public.posts (title, link_url) values ('Bad link', 'javascript:alert(1)')$$, '%posts_link_url_check%', 'post with a script link is refused');
select pg_temp.expect_error($$insert into public.blog_posts (slug, title, banner_url) values ('x-y', 'Bad banner', 'https://evil.example/a.png')$$, '%blog_posts_banner_url_check%', 'blog banner must come from our storage');
select pg_temp.expect_error($$insert into public.library_resources (title, kind, file_path, link_url) values ('Both', 'Guide', 'a.pdf', 'https://x.example')$$, '%check%', 'a resource is a file or a link, not both');
select pg_temp.expect_error($$insert into public.library_resources (title, kind, file_path) values ('Escape', 'Guide', '../other/a.pdf')$$, '%file_path_check%', 'file paths cannot climb out of the folder');

-- ---------------------------------------------------------------- anonymous visitors
set local role anon;
select set_config('request.jwt.claims', '', true);
select pg_temp.check((select count(*) from public.blog_posts) = 1, 'anon reads published blog posts only');
select pg_temp.check((select count(*) from public.content_items) = 2, 'anon reads published and scheduled content, not drafts');
select pg_temp.expect_error($$select count(*) from public.posts$$, '%permission denied%', 'anon cannot read the feed');
select pg_temp.expect_error($$select count(*) from public.library_resources$$, '%permission denied%', 'anon cannot list the Library');
select pg_temp.expect_error($$select public.open_resource('30000000-0000-0000-0000-000000000001')$$, '%permission denied%', 'anon cannot open resources');
select pg_temp.expect_error($$insert into public.blog_posts (slug, title) values ('hack', 'Hack')$$, '%permission denied%', 'anon cannot write blog posts');
select pg_temp.expect_error($$insert into public.topic_suggestions (text) values ('Hello there')$$, '%permission denied%', 'anon cannot suggest topics');

-- ---------------------------------------------------------------- member
reset role; set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select count(*) from public.posts) = 1, 'member sees published, due posts only');
select pg_temp.check((select title from public.posts) = 'Live post', 'scheduled and draft posts are hidden');
select pg_temp.check((select count(*) from public.blog_posts) = 1, 'member reads published blog posts only');
select pg_temp.check((select count(*) from public.library_resources) = 4, 'member lists published resources, locked ones included');
select pg_temp.check((select count(*) from public.library_resources where ready) = 3, 'member sees which resources have a file or link');
select pg_temp.expect_error($$select file_path from public.library_resources$$, '%permission denied%', 'member cannot read file paths');
select pg_temp.expect_error($$select link_url from public.library_resources$$, '%permission denied%', 'member cannot read resource links');
select pg_temp.expect_error($$select * from public.library_resources$$, '%permission denied%', 'select * is refused for members');
select pg_temp.check((public.open_resource('30000000-0000-0000-0000-000000000001') ->> 'file_path') = '2026-11/a.pdf', 'member opens an All members file');
select pg_temp.check((public.open_resource('30000000-0000-0000-0000-000000000004') ->> 'link_url') = 'https://example.com/skill', 'member opens an All members link');
select pg_temp.expect_error($$select public.open_resource('30000000-0000-0000-0000-000000000002')$$, '%locked%', 'learner-only file is locked for members');
select pg_temp.expect_error($$select public.open_resource('30000000-0000-0000-0000-000000000003')$$, '%not_found%', 'drafts cannot be opened');
select pg_temp.expect_error($$select public.open_resource('30000000-0000-0000-0000-000000000005')$$, '%no_file%', 'resource without a file says so');
select pg_temp.expect_error($$select * from public.admin_resource_targets()$$, '%forbidden%', 'member cannot list hidden columns');
select pg_temp.expect_error($$insert into public.posts (title) values ('Member post')$$, '%row-level security%', 'member cannot post to the feed');
select pg_temp.expect_error($$insert into public.blog_posts (slug, title) values ('mine', 'Mine')$$, '%row-level security%', 'member cannot write blog posts');
select pg_temp.expect_error($$insert into public.content_items (title, format, platform) values ('Mine', 'Short', 'TikTok')$$, '%row-level security%', 'member cannot add content');
select pg_temp.expect_error($$insert into public.library_resources (title, kind) values ('Mine', 'Guide')$$, '%row-level security%', 'member cannot add resources');
update public.posts set title = 'Hacked';
select pg_temp.check((select title from public.posts) = 'Live post', 'member cannot edit posts');
delete from public.blog_posts;
select pg_temp.check((select count(*) from public.blog_posts) = 1, 'member cannot delete blog posts');
select pg_temp.expect_error($$insert into public.publish_log (title, channels, sent_by) values ('x', '{feed}', auth.uid())$$, '%row-level security%', 'member cannot write the publishing history');
select pg_temp.check((select count(*) from public.publish_log) = 0, 'member cannot read the publishing history');

-- topics
insert into public.topic_suggestions (text) values ('When should a startup hire a CFO?');
select pg_temp.check((select member_id from public.topic_suggestions) = '00000000-0000-0000-0000-0000000000c1', 'topic is recorded as the member''s own');
select pg_temp.expect_error($$insert into public.topic_suggestions (text, member_id) values ('Pretend to be someone', '00000000-0000-0000-0000-0000000000c2')$$, '%permission denied%', 'member cannot suggest as someone else');
select pg_temp.expect_error($$insert into public.topic_suggestions (text, status) values ('Pick mine please', 'picked')$$, '%permission denied%', 'member cannot set a status');
select pg_temp.expect_error($$insert into public.topic_suggestions (text) values ('hi')$$, '%text_check%', 'topic needs at least 5 characters');
update public.topic_suggestions set status = 'picked';
select pg_temp.check((select status from public.topic_suggestions) = 'new', 'member cannot triage their own topic');
insert into public.topic_suggestions (text) values ('Topic two here'), ('Topic three here'), ('Topic four here'), ('Topic five here');
select pg_temp.expect_error($$insert into public.topic_suggestions (text) values ('Topic six here')$$, '%topic_limit%', 'at most 5 topics a day');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select pg_temp.check((select count(*) from public.topic_suggestions) = 0, 'members see only their own topics');

-- ---------------------------------------------------------------- admin without 2-step verification
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5', 'aal1');
select pg_temp.check((select count(*) from public.posts) = 1, 'admin without 2-step sees only what members see');
select pg_temp.expect_error($$insert into public.posts (title) values ('No 2-step')$$, '%row-level security%', 'admin without 2-step cannot post');

-- ---------------------------------------------------------------- admin
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5', 'aal2');
select pg_temp.check((select count(*) from public.posts) = 3, 'admin sees all posts');
select pg_temp.check((select count(*) from public.blog_posts) = 2, 'admin sees drafts');
select pg_temp.check((select count(*) from public.content_items) = 3, 'admin sees all content');
select pg_temp.check((select count(*) from public.library_resources) = 5, 'admin sees all resources');
select pg_temp.check((select count(*) from public.admin_resource_targets()) = 5, 'admin reads hidden columns through the function');
select pg_temp.check((public.open_resource('30000000-0000-0000-0000-000000000002') ->> 'file_path') = '2026-11/b.pdf', 'admin opens any level');
select pg_temp.check((public.open_resource('30000000-0000-0000-0000-000000000003') ->> 'link_url') = 'https://example.com/guide', 'admin opens drafts');
select pg_temp.check((select count(*) from public.topic_suggestions) = 5, 'admin sees every topic');
update public.topic_suggestions set status = 'picked' where text like 'When%';
select pg_temp.check((select count(*) from public.topic_suggestions where status = 'picked') = 1, 'admin triages topics');
insert into public.posts (title, status) values ('Admin post', 'published');
insert into public.blog_posts (slug, title) values ('new-one', 'New one');
insert into public.content_items (title, format, platform) values ('New tile', 'Carousel', 'LinkedIn');
insert into public.library_resources (title, kind, link_url) values ('New link', 'Guide', 'https://example.com/n');
update public.blog_posts set status = 'published' where slug = 'draft-post';
delete from public.content_items where title = 'Draft reel';
select pg_temp.check((select count(*) from public.content_items) = 3, 'admin creates and deletes content');
insert into public.publish_log (title, channels, sent_by, emails_sent) values ('Admin post', '{feed,email}', auth.uid(), 2);
select pg_temp.check((select count(*) from public.publish_log) = 1, 'admin records what was sent');
select pg_temp.expect_error($$insert into public.publish_log (title, channels, sent_by) values ('Other', '{feed}', '00000000-0000-0000-0000-0000000000c1')$$, '%row-level security%', 'history records the real sender');
select pg_temp.expect_error($$insert into public.publish_log (title, channels, sent_by) values ('Bad', '{sms}', auth.uid())$$, '%channels_check%', 'only known channels');
select pg_temp.expect_error($$update public.publish_log set emails_sent = 99$$, '%permission denied%', 'history cannot be edited');

-- ---------------------------------------------------------------- storage
reset role;
select pg_temp.check((select public from storage.buckets where id = 'library-files') = false, 'Library files bucket is private');
select pg_temp.check((select file_size_limit from storage.buckets where id = 'library-files') = 20971520, 'Library files up to 20 MB');
select pg_temp.check((select public from storage.buckets where id = 'content-images') = true, 'content images are public');
set local role authenticated;
insert into storage.objects (bucket_id, name) values ('content-images', 'admin.png');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name) values ('content-images', 'm.png')$$, '%row-level security%', 'member cannot upload content images');
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name) values ('library-files', 'm.pdf')$$, '%row-level security%', 'member cannot upload Library files');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'library-files') = 0, 'member cannot see Library files in storage');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5', 'aal2');
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name) values ('library-files', 'a.pdf')$$, '%row-level security%', 'even admins upload Library files only through signed links');

rollback;
