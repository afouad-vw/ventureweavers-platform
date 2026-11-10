-- Sample content from the prototype (run once in the SQL editor after 20261109000004_content.sql).
-- Blog posts are published. Digital content shows as "Coming" until real links are added.
-- Library items show "Coming soon" until files are uploaded. Feed posts and announcements start
-- as drafts so nothing goes to members before the partners review it.

insert into public.blog_posts (slug, title, category, author, published_on, read_time, summary, body, banner, tags, status) values
('three-things-founders-asked-us-this-month', 'Three things founders asked us this month', 'Newsletter', 'Fouad & Karim', '2026-11-03', '5 min',
 'Pricing in a moving currency, when to bring in a CFO, and how angels in MENA actually decide.',
 $b$**Pricing in a moving currency:** anchor to the value you deliver, review prices every quarter, and write that review into the contract so it is never a surprise.

**When to bring in a CFO:** when the numbers start deciding the strategy. Before that, a strong finance lead and a good accountant are enough.

**How angels in MENA decide:** the founder first, then the market, then the deck. Spend your preparation time accordingly.$b$,
 'Round', '{Pricing,Finance,Angels}', 'published'),
('why-we-are-opening-the-floor', 'Why we are opening the floor', 'Founder notes', 'Ahmed Fouad', '2026-10-20', '3 min',
 'Founders learn fastest from each other''s real questions. Open Floor puts those questions on stage.',
 $b$Founders learn fastest from each other's real questions. Open Floor puts those questions on stage, answered by operators who have sat on every side of the table.

Every show is built around the room. You bring the question, the room picks one, and we answer it together.$b$,
 'Stage', '{"Open Floor",Community}', 'published'),
('hiring-your-first-heads-without-slowing-down', 'Hiring your first heads without slowing down', 'Article', 'Karim Hemdan', '2026-10-12', '6 min',
 'The order we would hire in, what each first head should own, and the signals that it is time.',
 $b$Hire the head whose absence costs you most this quarter. For most seed-stage companies that is sales or operations, not marketing.

Give each first head one number they own and one problem they must solve in 90 days.$b$,
 'Room', '{Hiring,Team}', 'published'),
('what-we-learned-from-20-growth-diagnostics', 'What we learned from 20 growth diagnostics', 'Article', 'Fouad & Karim', '2026-11-18', '7 min',
 'Draft: patterns from the diagnostics we ran this year.', 'Draft in progress.', 'Pattern', '{Growth}', 'draft')
on conflict (slug) do nothing;

insert into public.content_items (title, series, format, platform, url, publish_on, status) values
('Do I raise now or wait for traction?', 'The Question', 'Short', 'Instagram', null, '2026-11-20', 'scheduled'),
('Your first head of sales, in 60 seconds', 'In 60 Seconds', 'Short', 'TikTok', null, '2026-11-22', 'scheduled'),
('Pricing when the currency moves: 3 rules', 'The Answer', 'Carousel', 'LinkedIn', null, '2026-11-24', 'scheduled'),
('Next show: Fri 27 Nov', 'Next Show', 'Reel', 'Instagram', null, '2026-11-21', 'scheduled'),
('Open Floor Show 01, full episode', 'Full episodes', 'Episode', 'YouTube', null, '2027-01-15', 'scheduled');

insert into public.library_resources (title, kind, space, access, description, status) values
('Venture building in MENA: what founders asked us in 2026', 'Report', 'House', 'all_members', 'Patterns from our sessions, diagnostics and shows.', 'published'),
('The growth diagnostic checklist', 'Guide', 'BRICKR', 'all_members', 'The questions we ask in the first session, so you can ask them first.', 'published'),
('Customer & market map', 'Template', 'TVS', 'tvs_learners', 'The canvas used in TVAC Module 3.', 'published'),
('Requirements sheet for an engagement', 'Template', 'BRICKR', 'brickr_clients', 'What to share before kick-off, and why.', 'published'),
('Pitch deck reviewer', 'AI skill', 'House', 'all_members', 'The questions investors will ask, slide by slide.', 'published'),
('Market sizing helper', 'AI skill', 'House', 'all_members', 'Top-down and bottom-up, with the assumptions shown.', 'published'),
('Investor profile drafter (preview)', 'AI skill', 'QuidQuo', 'quidquo_waitlist', 'An early piece of QuidQuo, for waitlist members.', 'published');

insert into public.posts (space, kind, title, body, banner, link_url, link_label, pinned_until, status, published_at) values
('Outloud', 'Short · In 60 Seconds', 'When should you hire your first head of sales?', 'Karim answers the question the room picked at the last Open Floor. One minute, one clear rule of thumb.', 'Stage', '/outloud?tab=content', 'Watch', null, 'draft', now()),
('TVS', 'Program', 'TVAC applications are open', 'The foundation program for every 360 track. Learn it in practice with founders at your stage.', null, '/tvs', 'View program', null, 'draft', now()),
('House', 'The Floor Notes · Issue 01', 'Three things founders asked us this month', 'Pricing in a moving currency, when to bring in a CFO, and how angels in MENA actually decide.', null, '/outloud/blog/three-things-founders-asked-us-this-month', 'Read', null, 'draft', now()),
('QuidQuo', 'Progress update', 'Prototype stage: matching engine in internal testing', 'Stage 2 of 4. Follow the build and be first in when it opens.', null, '/quidquo', 'Track progress', null, 'draft', now()),
('House', 'New in Library · AI skill', 'Pitch deck reviewer', 'Drop in your deck, get the questions an investor will ask.', null, '/library', 'Open in Library', null, 'draft', now()),
('BRICKR', 'Service', 'Growth diagnostic slots for December', 'A focused session with both partners on your market, numbers and next 90 days.', null, '/brickr', 'Book a slot', null, 'draft', now()),
('Outloud', 'Announcement', 'Show 02 seats are open', 'Fri 27 Nov, 7:00 PM in Cairo. Book early, seats are limited.', null, '/outloud', 'Book', '2026-11-27 21:59:00+00', 'draft', now()),
('TVS', 'Announcement', 'Next TVAC cohort: applications open', 'Applications close [DATE]. The cohort starts [DATE].', null, '/tvs', 'View program', '2026-12-31 21:59:00+00', 'draft', now()),
('QuidQuo', 'Announcement', 'Private beta invitations start soon', 'Waitlist members get the first invitations, in small groups.', null, '/quidquo', 'Join the waitlist', '2026-12-31 21:59:00+00', 'draft', now());
