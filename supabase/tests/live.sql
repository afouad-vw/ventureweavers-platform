-- Phase 8 tests: Live mode access, questions, upvotes, The Pick, polls. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a9', 'admin9@test', '{"name":"Admin Nine"}'),
  ('00000000-0000-0000-0000-0000000000e1', 'e1@test', '{"name":"Youssef Kamal"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'e2@test', '{"name":"Mona Adel"}'),
  ('00000000-0000-0000-0000-0000000000e3', 'e3@test', '{"name":"No Ticket"}');
insert into public.admin_users (user_id, username, display_name) values ('00000000-0000-0000-0000-0000000000a9', 'admin.nine', 'Admin Nine');
insert into public.events (id, slug, title, type, starts_at, venue, capacity, price_piasters, status) values
  ('80000000-0000-0000-0000-000000000001', 'live-show', 'Live show', 'public_show', now() + interval '1 hour', 'Cairo', 50, 1000, 'published'),
  ('80000000-0000-0000-0000-000000000002', 'live-private', 'Private', 'private_session', null, 'Office', 10, null, 'published');
insert into public.bookings (event_id, member_id, seats, amount_piasters, status, pay_reference) values
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', 1, 1000, 'confirmed', 'VWL-AAAA01'),
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e2', 1, 1000, 'confirmed', 'VWL-AAAA02'),
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e3', 1, 1000, 'reserved', 'VWL-AAAA03');

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

-- ---------------------------------------------------------------- before live opens
set local role anon;
select pg_temp.expect_error($$select public.live_state('80000000-0000-0000-0000-000000000001')$$, '%permission denied%', 'visitors cannot read live state');

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check((public.live_state('80000000-0000-0000-0000-000000000001') ->> 'open')::boolean = false, 'ticket holder sees live as closed before it opens');
select pg_temp.expect_error($$select public.live_ask('80000000-0000-0000-0000-000000000001', 'Too early?', false)$$, '%live_closed%', 'no questions before live opens');
select pg_temp.expect_error($$select public.admin_live_open('80000000-0000-0000-0000-000000000001', true)$$, '%not_admin%', 'members cannot open live mode');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000ee', 'aal2');
select pg_temp.expect_error($$select public.admin_live_open('80000000-0000-0000-0000-000000000001', true)$$, '%not_admin%', '2-step users who are not admins cannot open live mode');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a9', 'aal2');
select pg_temp.expect_error($$select public.admin_live_open('80000000-0000-0000-0000-000000000002', true)$$, '%not_a_show%', 'private sessions have no live mode');
select public.admin_live_open('80000000-0000-0000-0000-000000000001', true);
select pg_temp.check((select is_open from public.live_sessions where event_id = '80000000-0000-0000-0000-000000000001'), 'admins open live mode');

-- ---------------------------------------------------------------- members ask and vote
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e3');
select pg_temp.expect_error($$select public.live_state('80000000-0000-0000-0000-000000000001')$$, '%no_ticket%', 'unpaid reservation cannot join live mode');
select pg_temp.expect_error($$select public.live_ask('80000000-0000-0000-0000-000000000001', 'Let me in', false)$$, '%live_closed%', 'no ticket, no questions');
select pg_temp.check((select count(*) from public.live_sessions) = 0, 'no ticket, session row hidden');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check((select count(*) from public.live_sessions) = 1, 'ticket holder can read the session row (for Realtime)');
select public.live_ask('80000000-0000-0000-0000-000000000001', '  How do angels decide?  ', false);
select public.live_ask('80000000-0000-0000-0000-000000000001', 'Secret question', true);
select pg_temp.expect_error($$select public.live_ask('80000000-0000-0000-0000-000000000001', '   ', false)$$, '%bad_text%', 'empty questions refused');
select pg_temp.expect_error($$select public.live_ask('80000000-0000-0000-0000-000000000001', repeat('x', 281), false)$$, '%bad_text%', 'questions over 280 characters refused');
select pg_temp.expect_error($$insert into public.live_questions (event_id, member_id, text) values ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', 'direct')$$, '%permission denied%', 'members cannot insert questions directly');
select pg_temp.check(jsonb_array_length(public.live_state('80000000-0000-0000-0000-000000000001') -> 'questions') = 2, 'asker sees own waiting questions');
select pg_temp.check((select bool_and((q ->> 'text') = btrim(q ->> 'text')) from jsonb_array_elements(public.live_state('80000000-0000-0000-0000-000000000001') -> 'questions') q), 'question text is trimmed');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select pg_temp.check(jsonb_array_length(public.live_state('80000000-0000-0000-0000-000000000001') -> 'questions') = 0, 'others never see waiting questions');
select pg_temp.check((select count(*) from public.live_questions) = 0, 'members cannot read the questions table');
select public.live_ask('80000000-0000-0000-0000-000000000001', 'Q1', false);
select public.live_ask('80000000-0000-0000-0000-000000000001', 'Q2', false);
select public.live_ask('80000000-0000-0000-0000-000000000001', 'Q3', false);
select public.live_ask('80000000-0000-0000-0000-000000000001', 'Q4', false);
select public.live_ask('80000000-0000-0000-0000-000000000001', 'Q5', false);
select pg_temp.expect_error($$select public.live_ask('80000000-0000-0000-0000-000000000001', 'Q6', false)$$, '%question_limit%', 'at most 5 questions per person per show');
select pg_temp.expect_error($$select public.live_upvote((select id from public.live_questions limit 1))$$, '%', 'cannot upvote without seeing the question');
select pg_temp.expect_error($$select public.admin_live_pick('80000000-0000-0000-0000-000000000001')$$, '%not_admin%', 'members cannot pick');

-- ---------------------------------------------------------------- admins moderate
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a9', 'aal2');
select pg_temp.expect_error($$select public.admin_live_pick('80000000-0000-0000-0000-000000000001')$$, '%no_approved%', 'The Pick needs approved questions');
update public.live_questions set status = 'approved' where text in ('How do angels decide?', 'Secret question', 'Q1');
update public.live_questions set status = 'hidden' where text = 'Q2';
create temp table ids as select text, id from public.live_questions;
grant select on ids to authenticated;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select pg_temp.check(jsonb_array_length(public.live_state('80000000-0000-0000-0000-000000000001') -> 'questions') = 6, 'approved plus own waiting (hidden ones not shown)');
select pg_temp.check(public.live_upvote((select id from ids where text = 'How do angels decide?')), 'upvote on');
select pg_temp.check(not public.live_upvote((select id from ids where text = 'How do angels decide?')), 'second tap takes the upvote back');
select public.live_upvote((select id from ids where text = 'How do angels decide?'));
select pg_temp.expect_error($$select public.live_upvote((select id from ids where text = 'Q3'))$$, '%live_closed%', 'cannot upvote a waiting question');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select public.live_upvote((select id from ids where text = 'How do angels decide?'));
select pg_temp.check((public.live_state('80000000-0000-0000-0000-000000000001') -> 'questions' -> 0 ->> 'text') = 'How do angels decide?', 'top voted question first');
select pg_temp.check((public.live_state('80000000-0000-0000-0000-000000000001') -> 'questions' -> 0 ->> 'votes')::int = 2, 'votes counted');
select pg_temp.check((select count(*) from public.live_votes) = 0, 'members cannot read other people''s votes');

-- ---------------------------------------------------------------- The Pick
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a9', 'aal2');
select public.admin_live_pick('80000000-0000-0000-0000-000000000001');
select public.admin_live_pick('80000000-0000-0000-0000-000000000001');
select public.admin_live_pick('80000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from public.live_questions where picked_at is not null) = 3, 'each pick is a new approved question');
select pg_temp.check((select count(*) from public.live_questions where picked_at is not null and status <> 'approved') = 0, 'only approved questions are picked');
select pg_temp.expect_error($$select public.admin_live_pick('80000000-0000-0000-0000-000000000001')$$, '%no_approved%', 'no repeats once all are picked');
select pg_temp.expect_error($$update public.live_sessions set moment = 2$$, '%permission denied%', 'stage changes only through admin functions');
reset role;
update public.live_sessions set picked_question = (select id from ids where text = 'Secret question') where event_id = '80000000-0000-0000-0000-000000000001';
select pg_temp.check(public.live_asker('00000000-0000-0000-0000-0000000000e1', false) = 'Youssef', 'first name shown');
set local role authenticated;
select pg_temp.expect_error($$select public.live_asker('00000000-0000-0000-0000-0000000000e1', false)$$, '%permission denied%', 'members cannot look up names');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select pg_temp.check((public.live_state('80000000-0000-0000-0000-000000000001') -> 'picked' ->> 'who') = 'Anonymous', 'anonymous questions show no name');

-- ---------------------------------------------------------------- polls
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.expect_error($$insert into public.live_polls (event_id) values ('80000000-0000-0000-0000-000000000001')$$, '%row-level security%', 'members cannot create polls');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a9', 'aal2');
insert into public.live_polls (id, event_id) values
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001'),
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select public.admin_live_poll_open('81000000-0000-0000-0000-000000000001', true)$$, '%needs_options%', 'a poll needs at least 2 options');
insert into public.live_poll_options (id, poll_id, label, position) values
  ('82000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'Hiring', 1),
  ('82000000-0000-0000-0000-000000000002', '81000000-0000-0000-0000-000000000001', 'CFO', 2),
  ('82000000-0000-0000-0000-000000000003', '81000000-0000-0000-0000-000000000002', 'A', 1),
  ('82000000-0000-0000-0000-000000000004', '81000000-0000-0000-0000-000000000002', 'B', 2);
select public.admin_live_poll_open('81000000-0000-0000-0000-000000000001', true);
select public.admin_live_poll_open('81000000-0000-0000-0000-000000000002', true);
select pg_temp.check((select count(*) from public.live_polls where is_open) = 1, 'opening a poll closes the other');
select public.admin_live_poll_open('81000000-0000-0000-0000-000000000001', true);

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.expect_error($$select public.live_poll_vote('82000000-0000-0000-0000-000000000003')$$, '%poll_closed%', 'cannot vote in a closed poll');
select public.live_poll_vote('82000000-0000-0000-0000-000000000001');
select public.live_poll_vote('82000000-0000-0000-0000-000000000002');
select pg_temp.check((public.live_state('80000000-0000-0000-0000-000000000001') -> 'poll' ->> 'my_vote') = '82000000-0000-0000-0000-000000000002', 'vote can be changed');
select pg_temp.check(public.live_poll_vote('82000000-0000-0000-0000-000000000002') is null, 'same option again takes the vote back');
select public.live_poll_vote('82000000-0000-0000-0000-000000000001');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select public.live_poll_vote('82000000-0000-0000-0000-000000000001');
select pg_temp.check((select sum((o ->> 'votes')::int) from jsonb_array_elements(public.live_state('80000000-0000-0000-0000-000000000001') -> 'poll' -> 'options') o) = 2, 'one vote per person per poll');

-- ---------------------------------------------------------------- stage, version, end
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a9', 'aal2');
create temp table v0 as select version from public.live_sessions;
select public.admin_live_moment('80000000-0000-0000-0000-000000000001', 3);
select pg_temp.check((select moment from public.live_sessions) = 3 and (select version from public.live_sessions) > (select version from v0), 'moment change bumps the version');
select pg_temp.check(public.admin_live_end('80000000-0000-0000-0000-000000000001'), 'ending the show the first time sends feedback');
select pg_temp.check(not public.admin_live_end('80000000-0000-0000-0000-000000000001'), 'feedback goes only once');
select pg_temp.check((select moment from public.live_sessions) = 4 and (select count(*) from public.live_polls where is_open) = 0, 'end show: Your Voice, polls closed');
select public.admin_live_open('80000000-0000-0000-0000-000000000001', false);

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.check((public.live_state('80000000-0000-0000-0000-000000000001') ->> 'ended')::boolean, 'members see the show ended');
select pg_temp.expect_error($$select public.live_upvote((select id from ids where text = 'Q1'))$$, '%live_closed%', 'no votes after live mode closes');

rollback;
