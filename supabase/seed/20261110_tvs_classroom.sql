-- TVAC classroom outline from the prototype (run after 20261110000006_classroom.sql).
-- Modules have no opening dates yet ("Opens later"): set them in Admin › TVS › Classroom.

with c as (
  select co.id from public.cohorts co join public.programs p on p.id = co.program_id
  where p.slug = 'tvac' and not exists (select 1 from public.modules m where m.cohort_id = co.id)
  order by co.created_at limit 1
), mods as (
  insert into public.modules (cohort_id, position, title, summary)
  select c.id, v.pos, v.title, v.summary from c, (values
    (1, 'Venture foundations', 'How ventures are built, run and backed, and the language the rest of the program uses.'),
    (2, 'Problem & founder fit', 'Is this the right problem, and are you the right people to solve it?'),
    (3, 'Customer & market', 'Map who your customer really is and how big the reachable market is, using your own venture as the case. Work through the steps, then bring your map to the live session.'),
    (4, 'Business model', 'How the venture makes money, and what has to be true for that to work.'),
    (5, 'Money & metrics', 'Unit economics, runway and the few numbers that tell you how it is going.'),
    (6, 'Team & momentum', 'Who you need next, and how to keep moving when it gets hard.')
  ) as v(pos, title, summary)
  returning id, position
)
, steps as (
  insert into public.module_steps (module_id, position, title, kind, meta, url)
  select m.id, v.pos, v.title, v.kind, v.meta, v.url from mods m, (values
    (1, 'Read: The customer behind the customer', 'reading', '12 min', null),
    (2, 'Case: a Cairo marketplace finds its real buyer', 'case', 'PDF · 8 pages', null),
    (3, 'Assignment: customer & market map', 'assignment', 'Due [DATE]', null),
    (4, 'Use the AI skill: Market sizing helper', 'library', 'Library', '/library?type=AI%20skill')
  ) as v(pos, title, kind, meta, url)
  where m.position = 3
  returning 1
)
insert into public.assignments (module_id, title, brief)
select m.id, v.title, v.brief from mods m join (values
  (1, 'Founder fit canvas', 'Fill in the canvas for your venture and hand it in as a PDF.'),
  (2, 'Problem interviews summary', 'Summarise at least five problem interviews: who, what you heard, what surprised you.'),
  (3, 'Customer & market map', 'Use the template from the documents to map your customer and size the reachable market.'),
  (4, 'Business model draft', 'A one-page business model for your venture, with the assumptions marked.')
) as v(pos, title, brief) on v.pos = m.position;
