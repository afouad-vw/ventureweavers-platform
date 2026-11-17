-- Member news submissions. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'founder-news@test', '{"name":"Laila"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'other-news@test', '{"name":"Hany"}'),
  ('00000000-0000-0000-0000-0000000000e9', 'editor@test', '{}'),
  ('00000000-0000-0000-0000-0000000000e8', 'reqview@test', '{}');
insert into public.admin_users (user_id, username, display_name, permissions) values
  ('00000000-0000-0000-0000-0000000000e9', 'news.editor', 'News Editor', '{content.manage}'),
  ('00000000-0000-0000-0000-0000000000e8', 'req.viewer', 'Req Viewer', '{requests.view}');

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
create function pg_temp.share(headline text) returns uuid language sql as $$
  insert into public.news_submissions (business_name, news_type, headline, news_date, summary, details, preferred, contact_name, contact_email, consent)
  values ('Nile Pay', 'Funding round', headline, current_date, 'Nile Pay raised a seed round.', 'Details of the round.', 'Newsletter', 'Laila', 'founder-news@test', true)
  returning id $$;
grant execute on function pg_temp.share(text) to authenticated;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.share('Nile Pay raises seed') as first \gset
select pg_temp.check((select status = 'submitted' from public.news_submissions where id = :'first'), 'members share news');
select pg_temp.expect_error($$insert into public.news_submissions (business_name, news_type, headline, news_date, summary, details, contact_name, contact_email, consent) values ('X', 'Launch', 'Launch day', current_date, 's', 'd', 'L', 'l@test', false)$$, '%check%', 'sharing needs consent');
select pg_temp.expect_error($$insert into public.news_submissions (business_name, news_type, headline, news_date, summary, details, contact_name, contact_email, consent, status) values ('X', 'Launch', 'Launch day', current_date, 's', 'd', 'L', 'l@test', true, 'published')$$, '%row-level security%', 'members cannot publish their own news');
select pg_temp.share('Second'); select pg_temp.share('Third'); select pg_temp.share('Fourth'); select pg_temp.share('Fifth');
select pg_temp.expect_error($$select pg_temp.share('Sixth')$$, '%too_many_submissions%', 'five submissions a day at most');
select pg_temp.expect_error($$select public.admin_news_save('00000000-0000-0000-0000-000000000000', 'Hack', '', '', 'Newsletter', '', null, true)$$, '%not_admin%', 'members cannot review');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e2');
select pg_temp.check((select count(*) = 0 from public.news_submissions), 'members only see their own news');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e8');
select pg_temp.check((select count(*) = 5 from public.news_submissions), 'Requests viewers see submissions');
select pg_temp.expect_error(format($$select public.admin_news_save(%L, 'Nile Pay raises seed', 's', 'b', 'Newsletter', '', null, true)$$, :'first'), '%not_admin%', 'Requests viewers cannot publish');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000e9');
select public.admin_news_save(:'first', 'Nile Pay raises its seed round', 'Short summary', 'Body text', 'VW Notes', '', null, false);
select pg_temp.check((select s.status = 'in_review' and b.status = 'draft' and b.category = 'Founder notes' and b.author = 'Nile Pay' from public.news_submissions s join public.blog_posts b on b.id = s.blog_post_id where s.id = :'first'), 'saving makes a VW Notes draft credited to the business');
select public.admin_news_save(:'first', 'Nile Pay raises its seed round', 'Short summary', 'Edited body', 'Newsletter', 'Nile Pay team', null, true);
select pg_temp.check((select s.status = 'published' and b.status = 'published' and b.category = 'Newsletter' and b.body = 'Edited body' and b.author = 'Nile Pay team' from public.news_submissions s join public.blog_posts b on b.id = s.blog_post_id where s.id = :'first'), 'approving publishes the edited post');
select pg_temp.check((select count(*) = 1 from public.blog_posts where 'Member news' = any(tags)), 'one post per submission');
select pg_temp.expect_error(format($$select public.admin_news_decline(%L, 'no')$$, :'first'), '%published%', 'published news cannot be declined');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e9');
select public.admin_news_save(id, 'Second item', 's', 'b', 'Newsletter', '', null, false) from public.news_submissions where headline = 'Second';
select public.admin_news_decline(id, 'Please send more detail about the round.') from public.news_submissions where headline = 'Second';
select pg_temp.check((select status = 'declined' and decline_note like 'Please%' and blog_post_id is null from public.news_submissions where headline = 'Second'), 'declining keeps the note and removes the draft');

reset role;
select pg_temp.check((select count(*) = 2 from public.notifications where member_id = '00000000-0000-0000-0000-0000000000e1' and (text like 'Your news is published%' or text like 'We won''t publish%')), 'the member is told either way');
rollback;
