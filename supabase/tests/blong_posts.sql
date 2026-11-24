-- BLong community posts and engagement (Phase 19c). Run with: npm run test:db
\set ON_ERROR_STOP on
begin;
update public.blong_settings set approve_communities = false, approve_discussions = false, new_member_days = 0, link_new_days = 0, per_minute = 60,
  blocked_words = '{scam}';

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000a201', 'owner2@test', '{"name":"Omar Owner"}'),
  ('00000000-0000-0000-0000-00000000a202', 'mem2@test', '{"name":"Mona Member"}'),
  ('00000000-0000-0000-0000-00000000a203', 'out2@test', '{"name":"Ola Outsider"}'),
  ('00000000-0000-0000-0000-00000000a204', 'm4@test', '{"name":"Maya Four"}'),
  ('00000000-0000-0000-0000-00000000a205', 'm5@test', '{"name":"Mo Five"}'),
  ('00000000-0000-0000-0000-00000000a209', 'mod2@test', '{}');
insert into public.admin_users (user_id, username, display_name, permissions) values
  ('00000000-0000-0000-0000-00000000a209', 'comm.mod2', 'Community Mod', '{community.manage}');
update public.profiles set onboarded_at = now(), created_at = now() - interval '30 days' where id::text like '00000000-0000-0000-0000-00000000a20%';

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
create function pg_temp.as_user(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(text) to anon, authenticated;
create temp table s (k text primary key, v text);
grant all on s to authenticated;
create temp view v as select k, v::uuid as id from s where v ~ '^[0-9a-f-]{36}$';
grant select on v to authenticated;

set local role authenticated;

-- Two communities: Public and Private
select pg_temp.as_user('00000000-0000-0000-0000-00000000a201');
insert into s values ('pub_slug', public.create_community('Open founders', 'Open.', 'Interest', '{}', '{}', 'public'));
insert into s values ('prv_slug', public.create_community('Closed circle', 'Closed.', 'Interest', '{}', '{}', 'private'));
insert into s select 'pub', id::text from public.communities where slug = (select v from s where k = 'pub_slug');
insert into s select 'prv', id::text from public.communities where slug = (select v from s where k = 'prv_slug');
insert into s values ('p1', public.create_post((select id from v where k = 'pub'), 'Welcome! Introduce yourself below.', 'https://example.com/intro')::text);
insert into s values ('p2', public.create_post((select id from v where k = 'prv'), 'Members-only update.')::text);
select pg_temp.expect_error($$select public.create_post((select id from v where k = 'pub'), 'Bad link', 'javascript:alert(1)')$$, '%community_posts_link_url_check%', 'links must be https');
select pg_temp.expect_error($$select public.create_post((select id from v where k = 'pub'), 'img', null, 'https://evil.example/x.png')$$, '%bad_image%', 'images must be the member''s own uploads');

-- Who sees posts
select pg_temp.as_user('00000000-0000-0000-0000-00000000a203');
select pg_temp.check((select count(*) = 1 from public.community_wall((select id from v where k = 'pub'))), 'anyone can read a Public community''s wall');
select pg_temp.check((select count(*) = 0 from public.community_wall((select id from v where k = 'prv'))), 'Private walls are for members only');
select pg_temp.check((select count(*) = 1 from public.community_posts), 'row level security hides Private posts');
select pg_temp.expect_error($$select public.create_post((select id from v where k = 'pub'), 'Not a member yet')$$, '%not_in_community%', 'only members post');
select pg_temp.expect_error($$select public.add_comment((select id from v where k = 'p1'), 'Hello')$$, '%not_in_community%', 'only members comment');
select pg_temp.check((public.toggle_like('post', (select id from v where k = 'p1')) ->> 'liked')::boolean, 'anyone who can see a post likes it');
select pg_temp.expect_error($$select public.toggle_like('post', (select v::uuid from s where k = 'p2'))$$, '%not_found%', 'no likes on posts you can''t see');

-- Members comment, reply, like, save, view, share
select pg_temp.as_user('00000000-0000-0000-0000-00000000a202');
select public.join_community((select id from v where k = 'pub'));
insert into s values ('c1', public.add_comment((select id from v where k = 'p1'), 'Hi, I''m Mona, building a fintech.')::text);
select pg_temp.check((public.toggle_like('post', (select id from v where k = 'p1')) ->> 'likes')::int = 2, 'likes are counted');
select pg_temp.check(public.toggle_bookmark('post', (select id from v where k = 'p1')), 'members save posts');
select public.record_views('post', array[(select id from v where k = 'p1'), (select id from v where k = 'p1'), (select v::uuid from s where k = 'p2')]);
select public.record_share('post', (select id from v where k = 'p1'), 'link');
select public.record_share('post', (select id from v where k = 'p1'), 'link');
select pg_temp.check((select views = 1 and shares = 1 and comments = 1 and liked and saved from public.community_wall((select id from v where k = 'pub')) where id = (select id from v where k = 'p1')), 'views and shares count once per member; comments counted');
select pg_temp.check((select count(*) = 1 from public.my_saved()), 'saved posts show in My space');

select pg_temp.as_user('00000000-0000-0000-0000-00000000a201');
insert into s values ('c2', public.add_comment((select id from v where k = 'p1'), 'Welcome Mona!', (select id from v where k = 'c1'))::text);
insert into s values ('c3', public.add_comment((select id from v where k = 'p1'), 'Reply to a reply', (select id from v where k = 'c2'))::text);
reset role;
select pg_temp.check((select parent_id from public.post_comments where id = (select v::uuid from s where k = 'c3')) = (select v::uuid from s where k = 'c1'), 'replies stay one level deep');
select pg_temp.check((select count(*) = 1 from public.notifications where member_id = '00000000-0000-0000-0000-00000000a201' and text like '%commented on your post%'), 'the post''s author is told about comments');
select pg_temp.check((select count(*) = 1 from public.notifications where member_id = '00000000-0000-0000-0000-00000000a202' and text like '%replied to your comment%'), 'replies notify once an hour, not each time');
set local role authenticated;

-- Owners and admins
select public.set_post_flags((select id from v where k = 'p1'), true, true);
select pg_temp.as_user('00000000-0000-0000-0000-00000000a202');
select pg_temp.expect_error($$select public.add_comment((select id from v where k = 'p1'), 'More!')$$, '%comments_closed%', 'closed comments');
select pg_temp.expect_error($$select public.set_post_flags((select id from v where k = 'p1'), false)$$, '%not_allowed%', 'only owners and admins pin');
insert into s values ('p3', public.create_post((select id from v where k = 'pub'), 'A member post')::text);
select pg_temp.check((select id from public.community_wall((select id from v where k = 'pub')) limit 1) = (select id from v where k = 'p1'), 'pinned posts come first');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a201');
select public.set_community_posting((select id from v where k = 'pub'), 'admins');
select pg_temp.check((public.community_page((select v from s where k = 'pub_slug')) ->> 'posting') = 'admins', 'the page says who can post');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a202');
select pg_temp.expect_error($$select public.create_post((select id from v where k = 'pub'), 'Not allowed now')$$, '%admins_only%', 'Only admins post');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a201');
select public.remove_post((select id from v where k = 'p3'));
select pg_temp.check((select count(*) = 1 from public.community_wall((select id from v where k = 'pub'))), 'owners remove members'' posts');
select public.set_community_posting((select id from v where k = 'pub'), 'members');

-- Moderation: held posts and comments
select pg_temp.as_user('00000000-0000-0000-0000-00000000a202');
insert into s values ('held', public.create_post((select id from v where k = 'pub'), 'Not a scam, honest')::text);
select pg_temp.check((select mod_status from public.community_wall((select id from v where k = 'pub')) where id = (select id from v where k = 'held')) = 'held', 'the author sees their held post');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a203');
select pg_temp.check((select count(*) = 0 from public.community_wall((select id from v where k = 'pub')) where id = (select id from v where k = 'held')), 'others don''t');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a209');
select pg_temp.check((select count(*) = 1 from public.blong_held() where kind = 'post'), 'held posts are in the Held queue');
select public.review_held('post', (select id from v where k = 'held'), true);
select pg_temp.as_user('00000000-0000-0000-0000-00000000a203');
select pg_temp.check((select count(*) = 1 from public.community_wall((select id from v where k = 'pub')) where id = (select id from v where k = 'held')), 'published posts show');

-- Reports hide posts after three
select pg_temp.as_user('00000000-0000-0000-0000-00000000a203'); select public.report_content('post', (select id from v where k = 'held'), 'spam');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a204'); select public.join_community((select id from v where k = 'pub')); select public.report_content('post', (select id from v where k = 'held'), 'spam');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a205'); select public.join_community((select id from v where k = 'pub')); select public.report_content('post', (select id from v where k = 'held'), 'spam');
select pg_temp.check((select count(*) = 0 from public.community_wall((select id from v where k = 'pub')) where id = (select id from v where k = 'held')), 'three reports hide a post');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a202');
select pg_temp.expect_error($$select public.report_content('comment', (select id from v where k = 'c1'), 'spam')$$, '%not_found%', 'members can''t report their own comments');

-- Discussion messages: likes, saves, views, replies
select pg_temp.as_user('00000000-0000-0000-0000-00000000a201');
insert into s values ('room_slug', public.create_discussion('Hiring', 'Hiring talk.', 'Careers and hiring', '{}', 20, 'public'));
insert into s select 'room', id::text from public.discussions where slug = (select v from s where k = 'room_slug');
insert into s values ('m1', public.post_room_message((select id from v where k = 'room'), 'Who''s hiring engineers?')::text);
select pg_temp.as_user('00000000-0000-0000-0000-00000000a202');
select public.join_discussion((select id from v where k = 'room'));
select public.post_room_message((select id from v where k = 'room'), 'We are!', (select id from v where k = 'm1'));
select public.toggle_like('room_message', (select id from v where k = 'm1'));
select public.toggle_bookmark('room_message', (select id from v where k = 'm1'));
select public.record_views('room_message', array[(select id from v where k = 'm1')]);
select pg_temp.check((select likes = 1 and liked and saved and views = 1 and replies = 1 from public.room_messages((select id from v where k = 'room')) where id = (select id from v where k = 'm1')), 'discussion messages show likes, saves, views and replies');
select pg_temp.check((select count(*) = 2 from public.my_saved()), 'saved messages show in My space too');

-- Feed
select pg_temp.as_user('00000000-0000-0000-0000-00000000a204');
select pg_temp.check((select count(*) >= 1 from public.blong_feed() where kind = 'post'), 'the feed shows posts from your communities');

-- Section off hides walls
reset role;
update public.blong_settings set communities_on = false;
set local role authenticated;
select pg_temp.check((select count(*) = 0 from public.community_wall((select id from v where k = 'pub'))), 'walls hide while Communities are off');
select pg_temp.as_user('00000000-0000-0000-0000-00000000a202');
select pg_temp.check((select count(*) = 1 from public.my_saved()), 'and saved posts with them');

rollback;
