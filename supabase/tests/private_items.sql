-- Phase 15 part 2: private items. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'invited@test', '{"name":"Invited"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'outsider@test', '{"name":"Outsider"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'later@test', '{"name":"Joined Later"}'),
  ('00000000-0000-0000-0000-0000000000b9', 'evadmin@test', '{}'),
  ('00000000-0000-0000-0000-0000000000b8', 'bradmin@test', '{}');
insert into public.admin_users (user_id, username, display_name, permissions) values
  ('00000000-0000-0000-0000-0000000000b9', 'ev.admin', 'Events Admin', '{events.manage}'),
  ('00000000-0000-0000-0000-0000000000b8', 'br.admin', 'BRICKR Admin', '{brickr.manage}');

insert into public.events (id, slug, title, type, starts_at, venue, capacity, price_piasters, status, visibility) values
  ('70000000-0000-0000-0000-000000000001', 'vip-dinner', 'VIP dinner', 'workshop', now() + interval '10 days', 'Cairo', 10, 10000, 'published', 'private'),
  ('70000000-0000-0000-0000-000000000002', 'open-show', 'Open show', 'public_show', now() + interval '10 days', 'Cairo', 10, 10000, 'published', 'public');
insert into public.programs (id, slug, name, kind, status, visibility) values ('70000000-0000-0000-0000-000000000011', 'private-cohort', 'Private cohort', 'Foundation', 'open', 'private');
insert into public.services (id, slug, name, space, status, visibility) values ('70000000-0000-0000-0000-000000000021', 'private-svc', 'Private service', 'BRICKR', 'published', 'private');
insert into public.blog_posts (id, slug, title, body, status, visibility) values ('70000000-0000-0000-0000-000000000031', 'private-note', 'Private note', 'x', 'published', 'private');
insert into public.library_resources (id, title, kind, access, link_url, status, visibility) values ('70000000-0000-0000-0000-000000000041', 'Private deck', 'Guide', 'all_members', 'https://example.com/deck', 'published', 'private');

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

set local role authenticated;

-- Nobody is invited yet: members don't see any private item.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.check((select count(*) = 0 from public.events where visibility = 'private'), 'private events are hidden');
select pg_temp.check((select count(*) = 1 from public.events where slug = 'open-show'), 'public events still show');
select pg_temp.check((select count(*) = 0 from public.programs where slug = 'private-cohort'), 'private programs are hidden');
select pg_temp.check((select count(*) = 0 from public.services where slug = 'private-svc'), 'private services are hidden');
select pg_temp.check((select count(*) = 0 from public.blog_posts where slug = 'private-note'), 'private blog posts are hidden');
select pg_temp.check((select count(*) = 0 from public.library_resources where title = 'Private deck'), 'private resources are hidden');
select pg_temp.expect_error($$select public.book_event('70000000-0000-0000-0000-000000000001', 1)$$, '%not_found%', 'nobody books a private event they weren''t added to');
select pg_temp.expect_error($$select public.open_resource('70000000-0000-0000-0000-000000000041')$$, '%not_found%', 'nobody opens a private resource they weren''t added to');
select pg_temp.expect_error($$insert into public.requests (service_id, preferred_at) values ('70000000-0000-0000-0000-000000000021', now() + interval '2 days')$$, '%not_found%', 'nobody requests a private service they weren''t added to');
select pg_temp.expect_error($$insert into public.item_access (item_type, item_id, member_id) values ('event', '70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1')$$, '%permission%', 'members cannot add themselves');
select pg_temp.expect_error($$select public.admin_set_item_access('event', '70000000-0000-0000-0000-000000000001', '[{"member_id":"00000000-0000-0000-0000-0000000000b1"}]', 'VIP dinner', '/outloud/events/vip-dinner')$$, '%not_admin%', 'members cannot invite');

-- Staff only manage access in their own area.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b8');
select pg_temp.expect_error($$select public.admin_set_item_access('event', '70000000-0000-0000-0000-000000000001', '[]', 'VIP dinner', '/outloud/events/vip-dinner')$$, '%not_admin%', 'BRICKR staff cannot change who sees an event');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b9');
select pg_temp.check((select jsonb_array_length(public.admin_set_item_access('event', '70000000-0000-0000-0000-000000000001',
  '[{"member_id":"00000000-0000-0000-0000-0000000000b1","name":"Invited"},{"email":"New.Person@Test","name":"Not yet a member"},{"email":"invited@test"},{"member_id":"00000000-0000-0000-0000-0000000000b9"}]',
  'VIP dinner', '/outloud/events/vip-dinner')) = 2), 'events staff add a member and a contact by email (no duplicates, never admins)');
select pg_temp.expect_error($$select public.admin_set_item_access('event', '70000000-0000-0000-0000-000000000001', '[]', 'x', 'https://evil.example')$$, '%bad_href%', 'invite links stay inside the app');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.check((select count(*) = 1 from public.events where slug = 'vip-dinner'), 'the invited member sees the private event');
select pg_temp.check((public.book_event('70000000-0000-0000-0000-000000000001', 1) ->> 'status') = 'reserved', 'the invited member can book it');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.check((select count(*) = 0 from public.events where slug = 'vip-dinner'), 'others still don''t see it');
select pg_temp.check((select count(*) = 0 from public.item_access), 'members don''t see who else is invited');

-- A contact added by email sees it once they join with that email.
reset role;
update auth.users set email = 'new.person@test' where id = '00000000-0000-0000-0000-0000000000b3';
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select pg_temp.check((select count(*) = 1 from public.events where slug = 'vip-dinner'), 'a contact invited by email sees it after joining');

reset role;
select pg_temp.check((select count(*) = 1 from public.notifications where member_id = '00000000-0000-0000-0000-0000000000b1' and href = '/outloud/events/vip-dinner'), 'the invited member is told in their bell');
select pg_temp.check((select count(*) = 1 from public.audit_log where action = 'access.update' and entity_id = '70000000-0000-0000-0000-000000000001'), 'access changes are logged');

-- Removing someone takes access away; deleting the item clears its list.
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b9');
select public.admin_set_item_access('event', '70000000-0000-0000-0000-000000000001', '[{"email":"new.person@test"}]', 'VIP dinner', null);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.check((select count(*) = 0 from public.events where slug = 'vip-dinner'), 'removed members lose access');
reset role;
select pg_temp.check((select count(*) = 1 from public.item_access where item_id = '70000000-0000-0000-0000-000000000001'), 'the list keeps only who is still invited');
delete from public.blog_posts where id = '70000000-0000-0000-0000-000000000031';
insert into public.item_access (item_type, item_id, email) values ('blog', '70000000-0000-0000-0000-000000000041', 'x@test');
delete from public.library_resources where id = '70000000-0000-0000-0000-000000000041';
select pg_temp.check((select count(*) = 1 from public.item_access where item_type = 'blog' and item_id = '70000000-0000-0000-0000-000000000041'), 'cleanup only touches the matching kind of item');

rollback;
