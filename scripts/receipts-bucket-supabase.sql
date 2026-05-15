/*
 * Same as supabase/migrations/20260515120000_receipts_public_bucket.sql
 * Copy EVERYTHING from the first "insert" line to the end into Supabase SQL Editor.
 * Do not paste the file path as a line in the editor.
 */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipts_public_read" on storage.objects;
create policy "receipts_public_read"
on storage.objects
for select
to public
using (bucket_id = 'receipts');

drop policy if exists "receipts_authenticated_insert_own_folder" on storage.objects;
create policy "receipts_authenticated_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "receipts_authenticated_update_own_folder" on storage.objects;
create policy "receipts_authenticated_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "receipts_authenticated_delete_own_folder" on storage.objects;
create policy "receipts_authenticated_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
