insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can read website assets"
  on storage.objects for select
  to public
  using (bucket_id = 'site-assets');

create policy "Site admins can upload website assets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'site-assets'
    and (select public.is_site_admin())
  );
