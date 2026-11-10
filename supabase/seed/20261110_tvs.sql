-- TVS programs and masterclasses from the prototype (run after 20261110000005_tvs.sql).
-- Prices stay [PRICE] (null) until set; masterclass booking opens once a price is set.

insert into public.programs (slug, name, kind, description, weeks, price_piasters, requires_tvac, tags, banner, status, sort) values
('tvac', 'TVAC', 'Foundation', 'The shared ground: how ventures are built, run and backed, taught through cases from the region.', '[N]', null, false, '{Founders,Professionals,Cohort}', 'Room', 'open', 1),
('venture360', 'Venture360', '360 program', 'The full venture wheel for founders and intrapreneurs building something new.', '[N]', null, true, '{Founders,Intrapreneurs}', 'Round', 'open', 2),
('angel360', 'Angel360', '360 program', 'From understanding the ecosystem to finding your place as an angel investor.', '[N]', null, true, '{Angels,Investing}', 'Audience', 'in_development', 3),
('mentor360', 'Mentor360', '360 program', 'For experts and operators turning experience into mentorship that moves founders.', '[N]', null, true, '{Mentors,Experts}', 'Stage', 'in_development', 4)
on conflict (slug) do nothing;

insert into public.cohorts (program_id, label, status)
select id, 'Cohort [NO.]', 'planned' from public.programs where slug = 'tvac'
and not exists (select 1 from public.cohorts c join public.programs p on p.id = c.program_id where p.slug = 'tvac');

insert into public.events (slug, title, type, space, format, starts_at, venue, capacity, price_piasters, hosts, description, banner, status) values
('unit-economics-currency-shift', 'Unit economics that survive a currency shift', 'masterclass', 'TVS', 'Online', '2026-12-08 19:00+02', 'Online', 40, null, 'Karim Hemdan', 'Pricing, margins and cash when the currency moves, worked through with real numbers.', 'Round', 'published'),
('first-fundraise-mena', 'Your first fundraise in MENA, step by step', 'masterclass', 'TVS', 'In person', '2026-12-15 18:00+02', '[VENUE], Cairo', 30, null, 'Ahmed Fouad', 'From the first conversation to the term sheet: what to prepare and in what order.', 'Room', 'published'),
('hiring-your-first-heads', 'Hiring your first heads', 'masterclass', 'TVS', 'Online', '2027-01-12 19:00+02', 'Online', 40, null, 'Fouad & Karim', 'Who to hire first, what each first head should own, and the signals that it is time.', 'Stage', 'published')
on conflict (slug) do nothing;
