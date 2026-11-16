-- Run after the app that reads member_businesses is live (2026-11-17).
alter table public.profiles drop column if exists business_name, drop column if exists business_website, drop column if exists business_type;
