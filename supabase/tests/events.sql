-- Booking, capacity, payment and access tests for events. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin2@test', '{"name":"Admin"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'm1@test', '{"name":"Member One"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'm2@test', '{"name":"Member Two"}'),
  ('00000000-0000-0000-0000-0000000000b3', 'm3@test', '{"name":"Member Three"}');
insert into public.admin_users (user_id, username, display_name) values ('00000000-0000-0000-0000-0000000000a1', 'admin.two', 'Admin');

insert into public.events (id, slug, title, type, starts_at, venue, capacity, price_piasters, status) values
  ('10000000-0000-0000-0000-000000000001', 'show-01', 'Open Floor Show 01', 'public_show', now() + interval '10 days', 'Cairo', 3, 45000, 'published'),
  ('10000000-0000-0000-0000-000000000002', 'draft-show', 'Draft show', 'workshop', now() + interval '10 days', 'Cairo', 10, 1000, 'draft'),
  ('10000000-0000-0000-0000-000000000003', 'private', 'Private session', 'private_session', null, 'Your office', 40, null, 'published'),
  ('10000000-0000-0000-0000-000000000004', 'no-price', 'Price to come', 'public_show', now() + interval '10 days', 'Cairo', 10, null, 'published'),
  ('10000000-0000-0000-0000-000000000005', 'past', 'Past show', 'public_show', now() - interval '1 day', 'Cairo', 10, 1000, 'published'),
  ('10000000-0000-0000-0000-000000000006', 'soon', 'Tomorrow show', 'public_show', now() + interval '30 hours', 'Cairo', 10, 1000, 'published');

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

-- deadline rule
select pg_temp.check(public.payment_deadline(now() + interval '10 days', now()) = now() + interval '48 hours', 'deadline is 48h when the show is far away');
select pg_temp.check(public.payment_deadline(now() + interval '50 hours', now()) = now() + interval '26 hours', 'deadline is 24h before the show when sooner');
select pg_temp.check(public.payment_deadline(now() + interval '20 hours', now()) = now() + interval '2 hours', 'show within a day: 2 hours to pay');
select pg_temp.check(public.payment_deadline(now() + interval '1 hour', now()) = now() + interval '1 hour', 'never past the start');

-- ---------- anonymous
set local role anon;
select set_config('request.jwt.claims', '', true);
select pg_temp.check((select count(*) from public.events) = 5, 'anon sees only published events');
select pg_temp.check(public.event_seats_left('10000000-0000-0000-0000-000000000001') = 3, 'anon sees seats left');
select pg_temp.check(public.event_seats_left('10000000-0000-0000-0000-000000000002') is null, 'anon gets nothing for a draft');
select pg_temp.expect_error($$select public.book_event('10000000-0000-0000-0000-000000000001', 1)$$, '%permission denied%', 'anon cannot book');
select pg_temp.expect_error($$insert into public.events (slug, title, starts_at) values ('x-x', 'Hack', now())$$, '%permission denied%', 'anon cannot create events');

-- ---------- member one books 2 of 3
reset role; set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.check((public.book_event('10000000-0000-0000-0000-000000000001', 2) ->> 'status') = 'reserved', 'member books 2 seats, reserved');
select pg_temp.check((select amount_piasters from public.bookings) = 90000, 'amount is seats x price in piasters');
select pg_temp.check((select hold_expires_at from public.bookings) = now() + interval '48 hours', 'hold set to the deadline');
select pg_temp.check((select code from public.tickets) ~ '^VW-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$', 'ticket code issued');
select pg_temp.check(public.event_seats_left('10000000-0000-0000-0000-000000000001') = 1, 'reservation holds the seats');
select pg_temp.expect_error($$select public.book_event('10000000-0000-0000-0000-000000000001', 1)$$, '%already_booked%', 'one active booking per member');
select pg_temp.expect_error($$update public.bookings set status = 'confirmed'$$, '%permission denied%', 'member cannot confirm their own booking');
select pg_temp.expect_error($$update public.payments set status = 'paid'$$, '%permission denied%', 'member cannot mark payment paid');
select pg_temp.expect_error($$select public.admin_mark_paid((select id from public.bookings limit 1))$$, '%forbidden%', 'member cannot use admin mark paid');
select pg_temp.expect_error($$select public.admin_check_in((select code from public.tickets limit 1))$$, '%forbidden%', 'member cannot check in tickets');
select pg_temp.check((public.payment_instructions() ->> 'bank_details') = '', 'member can read payment instructions');
select pg_temp.check((select count(*) from public.site_settings) = 0, 'settings table hidden from members');

-- ---------- limits and closed events
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.expect_error($$select public.book_event('10000000-0000-0000-0000-000000000001', 3)$$, '%seat_limit%', 'max 2 seats per booking');
select pg_temp.expect_error($$select public.book_event('10000000-0000-0000-0000-000000000001', 0)$$, '%seat_limit%', 'at least 1 seat');
select pg_temp.expect_error($$select public.book_event('10000000-0000-0000-0000-000000000001', 2)$$, '%sold_out%', 'cannot exceed capacity');
select pg_temp.expect_error($$select public.book_event('10000000-0000-0000-0000-000000000002', 1)$$, '%not_found%', 'cannot book a draft');
select pg_temp.expect_error($$select public.book_event('10000000-0000-0000-0000-000000000003', 1)$$, '%request_only%', 'private sessions are by request');
select pg_temp.expect_error($$select public.book_event('10000000-0000-0000-0000-000000000004', 1)$$, '%not_open%', 'no price yet, booking not open');
select pg_temp.expect_error($$select public.book_event('10000000-0000-0000-0000-000000000005', 1)$$, '%event_started%', 'cannot book a past event');
select pg_temp.check((select count(*) from public.bookings) = 0, 'member two cannot see member one''s booking');
select pg_temp.check((select count(*) from public.tickets) = 0, 'member two cannot see member one''s ticket');
select pg_temp.check((public.book_event('10000000-0000-0000-0000-000000000001', 1) ->> 'seats') = '1', 'member two takes the last seat');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select pg_temp.expect_error($$select public.book_event('10000000-0000-0000-0000-000000000001', 1)$$, '%sold_out%', 'sold out after the last seat');

-- ---------- expiry returns seats
reset role;
update public.bookings set hold_expires_at = now() - interval '1 minute'
  where member_id = '00000000-0000-0000-0000-0000000000b1';
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select pg_temp.check(public.event_seats_left('10000000-0000-0000-0000-000000000001') = 2, 'lapsed hold frees its seats');
select pg_temp.check((public.book_event('10000000-0000-0000-0000-000000000001', 2) ->> 'status') = 'reserved', 'freed seats can be booked');
reset role;
select pg_temp.check((select status from public.bookings where member_id = '00000000-0000-0000-0000-0000000000b1') = 'expired', 'lapsed booking marked expired');
select pg_temp.check((select p.status from public.payments p join public.bookings b on b.id = p.booking_id where b.member_id = '00000000-0000-0000-0000-0000000000b1') = 'expired', 'its payment marked expired');

-- ---------- member cancels own reservation
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select public.cancel_my_booking((select id from public.bookings where status = 'reserved'));
select pg_temp.check((select status from public.bookings) = 'cancelled', 'member cancels own reservation');
select pg_temp.check(public.event_seats_left('10000000-0000-0000-0000-000000000001') = 1, 'cancel frees the seat');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
select pg_temp.expect_error($$select public.cancel_my_booking((select id from public.bookings b where b.member_id <> auth.uid() limit 1))$$, '%not_cancellable%', 'cannot cancel someone else''s booking');

-- ---------- admin: needs 2-step
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'aal1');
select pg_temp.expect_error($$select public.admin_mark_paid('00000000-0000-0000-0000-000000000000')$$, '%forbidden%', 'admin without 2-step cannot mark paid');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'aal2');
select pg_temp.check((select count(*) from public.events) = 6, 'admin sees drafts');
select pg_temp.check((select count(*) from public.bookings) = 3, 'admin sees all bookings');

-- check-in before payment is refused
select pg_temp.check((public.admin_check_in((select t.code from public.tickets t join public.bookings b on b.id = t.booking_id where b.member_id = '00000000-0000-0000-0000-0000000000b3')) ->> 'result') = 'unpaid', 'unpaid ticket refused at the door');

-- mark paid, then check in, then a second scan
select public.admin_mark_paid((select id from public.bookings where member_id = '00000000-0000-0000-0000-0000000000b3'));
select pg_temp.check((select status from public.bookings where member_id = '00000000-0000-0000-0000-0000000000b3') = 'confirmed', 'admin marks paid, booking confirmed');
select pg_temp.check((select p.status from public.payments p join public.bookings b on b.id = p.booking_id where b.member_id = '00000000-0000-0000-0000-0000000000b3') = 'paid', 'payment recorded as paid');
select pg_temp.check((select hold_expires_at from public.bookings where member_id = '00000000-0000-0000-0000-0000000000b3') is null, 'confirmed booking has no deadline');
select pg_temp.check((public.admin_check_in(lower((select t.code from public.tickets t join public.bookings b on b.id = t.booking_id where b.member_id = '00000000-0000-0000-0000-0000000000b3'))) ->> 'result') = 'ok', 'check-in works (any letter case)');
select pg_temp.check((public.admin_check_in((select t.code from public.tickets t join public.bookings b on b.id = t.booking_id where b.member_id = '00000000-0000-0000-0000-0000000000b3')) ->> 'result') = 'already', 'second scan flagged as already used');
select pg_temp.check((public.admin_check_in('VW-NOPE-NOPE') ->> 'result') = 'not_found', 'unknown code not found');

-- late payment of an expired booking only if seats are still free (1 seat left, expired booking had 2)
select pg_temp.expect_error($$select public.admin_mark_paid((select id from public.bookings where member_id = '00000000-0000-0000-0000-0000000000b1'))$$, '%sold_out%', 'late payment refused when seats are gone');

-- cancel with refund
select public.admin_cancel_booking((select id from public.bookings where member_id = '00000000-0000-0000-0000-0000000000b3'), true);
select pg_temp.check((select status from public.bookings where member_id = '00000000-0000-0000-0000-0000000000b3') = 'refunded', 'admin cancels with refund');
select pg_temp.check((select p.status from public.payments p join public.bookings b on b.id = p.booking_id where b.member_id = '00000000-0000-0000-0000-0000000000b3') = 'refunded', 'payment marked refunded');
select pg_temp.check(public.event_seats_left('10000000-0000-0000-0000-000000000001') = 3, 'refund frees the seats');

-- admin edits events and settings; changes are audited
update public.events set capacity = 5 where slug = 'show-01';
select pg_temp.check((select capacity from public.events where slug = 'show-01') = 5, 'admin edits an event');
update public.site_settings set value = 'Bank: [BANK DETAILS]' where key = 'bank_details';
select pg_temp.check((select value from public.site_settings where key = 'bank_details') = 'Bank: [BANK DETAILS]', 'admin edits bank details');
reset role;
select pg_temp.check((select count(*) from public.audit_log where action in ('booking.mark_paid', 'ticket.check_in', 'booking.refunded')) = 3, 'admin actions written to the audit log');

-- events with bookings cannot be deleted (unpublish instead)
select pg_temp.expect_error($$delete from public.events where slug = 'show-01'$$, '%foreign key%', 'event with bookings cannot be deleted');

-- saved items are private
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into public.saved_items (member_id, item_type, item_id) values (auth.uid(), 'blog', 'post-1');
select pg_temp.expect_error($$insert into public.saved_items (member_id, item_type, item_id) values ('00000000-0000-0000-0000-0000000000b2', 'blog', 'x')$$, '%row-level security%', 'cannot save on someone else''s behalf');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.check((select count(*) from public.saved_items) = 0, 'saved items are private');

-- ---------- banner uploads (storage)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name) values ('event-banners', 'x/hack.jpg')$$, '%row-level security%', 'member cannot upload a banner');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'aal1');
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name) values ('event-banners', 'x/a.jpg')$$, '%row-level security%', 'admin without 2-step cannot upload');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'aal2');
insert into storage.objects (bucket_id, name) values ('event-banners', 'x/ok.jpg');
select pg_temp.check(true, 'admin with 2-step can upload a banner');
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name) values ('other-bucket', 'x.jpg')$$, '%', 'admin rule covers only the banner folder');
update public.events set banner_url = 'https://abc.supabase.co/storage/v1/object/public/event-banners/x/ok.jpg' where slug = 'show-01';
select pg_temp.check((select banner_url from public.events where slug = 'show-01') like '%event-banners%', 'event stores an uploaded banner');
select pg_temp.expect_error($$update public.events set banner_url = 'https://evil.example/x.jpg' where slug = 'show-01'$$, '%check constraint%', 'banner must come from the banner folder');

rollback;
\echo ALL EVENT TESTS PASSED
