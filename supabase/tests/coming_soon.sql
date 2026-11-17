-- Phase 16: booking per service, Coming soon and waitlists. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'waiter@test', '{"name":"Waiter"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'other@test', '{"name":"Other"}'),
  ('00000000-0000-0000-0000-0000000000c9', 'tvsadmin@test', '{}'),
  ('00000000-0000-0000-0000-0000000000c8', 'bradmin2@test', '{}');
insert into public.admin_users (user_id, username, display_name, permissions) values
  ('00000000-0000-0000-0000-0000000000c9', 'tvs.admin2', 'TVS Admin', '{tvs.manage}'),
  ('00000000-0000-0000-0000-0000000000c8', 'br.admin2', 'BRICKR Admin', '{brickr.manage}');

insert into public.services (id, slug, name, space, status) values
  ('80000000-0000-0000-0000-000000000001', 'soon-svc', 'Soon service', 'BRICKR', 'coming_soon'),
  ('80000000-0000-0000-0000-000000000002', 'live-svc', 'Live service', 'BRICKR', 'published'),
  ('80000000-0000-0000-0000-000000000003', 'draft-svc', 'Draft service', 'BRICKR', 'draft'),
  ('80000000-0000-0000-0000-000000000004', 'soon-private', 'Soon private', 'BRICKR', 'coming_soon');
update public.services set visibility = 'private' where slug = 'soon-private';
insert into public.programs (id, slug, name, kind, status) values ('80000000-0000-0000-0000-000000000011', 'soon-program', 'Soon program', '360 program', 'coming_soon');
insert into public.events (id, slug, title, type, starts_at, venue, capacity, price_piasters, status) values
  ('80000000-0000-0000-0000-000000000021', 'soon-class', 'Soon class', 'masterclass', now() + interval '20 days', 'Cairo', 10, 10000, 'coming_soon');

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

-- Booking settings: calendar needs a Calendly link, and only calendly.com links.
select pg_temp.expect_error($$update public.services set booking = 'calendar', calendly_url = null where slug = 'live-svc'$$, '%services_calendar_needs_link%', 'calendar booking needs a link');
select pg_temp.expect_error($$update public.services set booking = 'both', calendly_url = 'https://evil.example/karim' where slug = 'live-svc'$$, '%calendly_url%', 'only calendly.com links');
update public.services set booking = 'both', calendly_url = 'https://calendly.com/karim/brickr-intro' where slug = 'live-svc';
select pg_temp.check((select booking = 'both' from public.services where slug = 'live-svc'), 'a service can offer both');
select pg_temp.check((select space = 'TVS' and status = 'published' from public.services where slug = 'private-class'), 'the private class service exists');
select pg_temp.check((select name = 'Private program' from public.services where slug = 'custom-program'), 'custom program is now Private program');
select pg_temp.check((select count(*) = 0 from public.programs where status = 'in_development'), 'no programs left in development');

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');

-- Coming soon items are visible; drafts and private items stay hidden.
select pg_temp.check((select count(*) = 2 from public.services where slug in ('soon-svc', 'live-svc', 'draft-svc', 'soon-private')), 'members see coming soon and published services only');
select pg_temp.check((select count(*) = 1 from public.programs where slug = 'soon-program'), 'members see coming soon programs');
select pg_temp.check((select count(*) = 1 from public.events where slug = 'soon-class'), 'members see coming soon events');

-- But nothing can be booked, requested or applied for yet.
select pg_temp.expect_error($$select public.book_event('80000000-0000-0000-0000-000000000021', 1)$$, '%not_found%', 'coming soon events cannot be booked');
select pg_temp.expect_error($$insert into public.requests (service_id, preferred_at) values ('80000000-0000-0000-0000-000000000001', now() + interval '2 days')$$, '%service_closed%', 'coming soon services cannot be requested');

-- Joining waitlists.
insert into public.waitlist_entries (item_type, item_id) values ('service', '80000000-0000-0000-0000-000000000001');
insert into public.waitlist_entries (item_type, item_id) values ('program', '80000000-0000-0000-0000-000000000011');
insert into public.waitlist_entries (item_type, item_id) values ('event', '80000000-0000-0000-0000-000000000021');
select pg_temp.check((select count(*) = 3 from public.waitlist_entries), 'a member joins three lists');
select pg_temp.expect_error($$insert into public.waitlist_entries (item_type, item_id) values ('service', '80000000-0000-0000-0000-000000000001')$$, '%duplicate%', 'once per item');
select pg_temp.expect_error($$insert into public.waitlist_entries (item_type, item_id) values ('service', '80000000-0000-0000-0000-000000000002')$$, '%not_coming_soon%', 'only coming soon items take sign-ups');
select pg_temp.expect_error($$insert into public.waitlist_entries (item_type, item_id) values ('service', '80000000-0000-0000-0000-000000000003')$$, '%not_coming_soon%', 'drafts take no sign-ups');
select pg_temp.expect_error($$insert into public.waitlist_entries (item_type, item_id) values ('service', '80000000-0000-0000-0000-000000000004')$$, '%not_coming_soon%', 'private items they cannot see take no sign-ups');
select pg_temp.expect_error($$insert into public.waitlist_entries (item_type, item_id, member_id) values ('service', '80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c2')$$, '%permission%', 'nobody signs up someone else');
select pg_temp.expect_error($$select public.admin_add_to_waitlist('service', '80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c2')$$, '%not_admin%', 'members cannot add people');

-- Members only see their own entries.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c2');
select pg_temp.check((select count(*) = 0 from public.waitlist_entries), 'others cannot see my entries');
delete from public.waitlist_entries;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.check((select count(*) = 3 from public.waitlist_entries), 'others cannot remove my entries');

-- Staff see and manage lists in their own area only.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c9');
select pg_temp.check((select count(*) = 2 from public.waitlist_entries), 'TVS staff see the program and masterclass lists');
select pg_temp.expect_error($$select public.admin_add_to_waitlist('service', '80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c2')$$, '%not_admin%', 'TVS staff cannot add to BRICKR lists');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c8');
select pg_temp.check((select public.admin_add_to_waitlist('service', '80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c2')), 'BRICKR staff add a member');
select pg_temp.check((select not public.admin_add_to_waitlist('service', '80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c2')), 'adding twice does nothing');
select pg_temp.expect_error($$select public.admin_add_to_waitlist('service', '80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c9')$$, '%not_member%', 'admins are not added to lists');
select pg_temp.check((select count(*) = 2 from public.waitlist_entries where item_type = 'service'), 'BRICKR staff see the service list');

-- Going live notifies everyone on the list, once.
update public.services set status = 'published' where slug = 'soon-svc';
select pg_temp.check((select count(*) = 2 from public.waitlist_entries where item_type = 'service' and notified_at is not null), 'the whole list is marked notified');
reset role;
select pg_temp.check((select count(*) = 2 from public.notifications where text = 'Soon service is now open.' and href = '/brickr/services/soon-svc'), 'each person gets one bell notification');
update public.services set status = 'coming_soon' where slug = 'soon-svc';
update public.services set status = 'published' where slug = 'soon-svc';
select pg_temp.check((select count(*) = 2 from public.notifications where text = 'Soon service is now open.'), 'going live again does not notify twice');
update public.programs set status = 'open' where slug = 'soon-program';
select pg_temp.check((select count(*) = 1 from public.notifications where href = '/tvs/programs/soon-program'), 'programs notify when they open');
update public.events set status = 'published' where slug = 'soon-class';
select pg_temp.check((select count(*) = 1 from public.notifications where href = '/tvs/masterclasses/soon-class'), 'masterclasses notify with their own address');

-- Deleting an item removes its list.
delete from public.events where slug = 'soon-class';
select pg_temp.check((select count(*) = 0 from public.waitlist_entries where item_type = 'event'), 'lists go with their item');

rollback;
