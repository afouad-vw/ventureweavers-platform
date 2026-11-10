-- BRICKR services and QuidQuo progress from the prototype (run after 20261110000007_brickr_quidquo.sql).
-- Services and stages are live; build log entries start as drafts for the partners to review.

insert into public.services (slug, name, space, audience, format, description, banner, status, sort) values
('growth-diagnostic', 'Growth diagnostic', 'BRICKR', 'Founders', 'One session · written read-out', 'Market, strategic, tactical, financial and fundraising context in one sitting, and the three moves that matter next.', 'Round', 'published', 1),
('fractional-partnership', 'Fractional partnership', 'BRICKR', 'Founders', 'Monthly engagement', 'Two integrated partners working with you on growth initiatives, with a shared action plan and monthly reviews.', 'Room', 'published', 2),
('fundraising-readiness', 'Fundraising readiness', 'BRICKR', 'Founders', 'Sprint', 'Story, numbers and data room ready before you meet investors.', 'Audience', 'published', 3),
('portfolio-mentorship', 'Portfolio mentorship', 'BRICKR', 'Investors & programs', 'Per portfolio', 'Structured mentorship for your portfolio companies, run by the partners.', 'Crowd', 'published', 4),
('open-floor-private-session', 'Open Floor private session', 'Outloud', 'Companies & teams', 'Per session', 'A private Open Floor for your team: your topic, your space, with follow-up.', 'Stage', 'published', 5)
on conflict (slug) do nothing;

insert into public.qq_stages (position, name, description, progress)
select v.* from (values
  (1, 'Research', 'Interviews with founders and investors on how rounds really run.', 100),
  (2, 'Prototype', 'Matching engine and profile builder in internal testing.', 60),
  (3, 'Private beta', 'First waitlist members invited, in small groups.', 0),
  (4, 'Launch', 'Open to the platform''s members first.', 0)
) as v(position, name, description, progress)
where not exists (select 1 from public.qq_stages);

insert into public.qq_log (entry_date, title, body, status)
select v.d::date, v.t, v.b, 'draft' from (values
  ('2026-11-05', 'Profile builder drafts a one-page founder summary', 'Upload a deck, get a structured profile investors can scan in a minute.'),
  ('2026-10-22', 'First matching run on test data', 'Stage, sector and ticket size used to rank fit.'),
  ('2026-10-01', 'Research wrap-up shared on Outloud', 'What we learned about how rounds stall, and what we are building first.')
) as v(d, t, b)
where not exists (select 1 from public.qq_log);
