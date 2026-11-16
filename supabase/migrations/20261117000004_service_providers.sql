-- Phase 15 (approved 2026-11-17), part 1: BRICKR service providers.

-- Providers: [{ name, title, photo, brief, linkedin }], at most 10, brief up to 400 characters.
create or replace function public.is_providers(v jsonb) returns boolean language sql immutable set search_path = '' as $$
  select public.is_people(v) and not exists (
    select 1 from jsonb_array_elements(v) p
    where char_length(coalesce(p->>'brief', '')) > 400
       or char_length(coalesce(p->>'photo', '')) > 300
       or char_length(coalesce(p->>'linkedin', '')) > 200) $$;
revoke all on function public.is_providers(jsonb) from public;
grant execute on function public.is_providers(jsonb) to anon, authenticated, service_role;

alter table public.services add column providers jsonb not null default '[]' check (public.is_providers(providers));

-- The current BRICKR services are delivered by both partners.
update public.services set providers = '[
  {"name": "Ahmed Fouad", "title": "Co-founder & Partner, VentureWeavers", "photo": "/images/ahmed.jpg", "linkedin": "https://www.linkedin.com/in/ahmed-fouad-azm",
   "brief": "Operator, investor and advisor. Ahmed built and ran ventures including Easy Taxi, Yumamia, Akelni, Tabibi and Toggar, invests through SeaSand CVC and DINARe Ventures, and advises founders through Sweetspot and the GLG council. He started out in engineering and consulting."},
  {"name": "Karim Hemdan", "title": "Co-founder & Partner, VentureWeavers", "photo": "/images/karim.jpg", "linkedin": "https://www.linkedin.com/in/karim-hemdan",
   "brief": "Operator, investor and advisor. Karim learned the venture playbook at Rocket Internet in Berlin and ran operations at Easy Taxi, Yumamia, Jumia Group and Delivery Hero (Talabat). He invests through SeaSand CVC and DINARe Ventures, advises through Sweetspot, the GLG council and HOF Studio, and is a 500 Global VC Unlocked fellow."}
]'::jsonb
where space = 'BRICKR' and providers = '[]'::jsonb;
