-- Uploaded event banners. Anyone can view them (they appear on public event pages);
-- only admins with 2-step verification can upload, replace or delete.

alter table public.events add column banner_url text
  check (banner_url is null or (char_length(banner_url) <= 500 and banner_url ~ '^https://[^ ]+/storage/v1/object/public/event-banners/[A-Za-z0-9/_.-]+$'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-banners', 'event-banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins upload event banners" on storage.objects
  for insert to authenticated with check (bucket_id = 'event-banners' and public.is_admin());
create policy "Admins replace event banners" on storage.objects
  for update to authenticated using (bucket_id = 'event-banners' and public.is_admin()) with check (bucket_id = 'event-banners' and public.is_admin());
create policy "Admins delete event banners" on storage.objects
  for delete to authenticated using (bucket_id = 'event-banners' and public.is_admin());
