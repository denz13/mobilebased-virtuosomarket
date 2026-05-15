/*
 * HOW TO RUN (important)
 * Open THIS FILE in your editor, select ALL text from the next line downward,
 * copy, paste into Supabase → SQL Editor → New query, then click Run.
 * Do NOT paste the filename or path (e.g. supabase/migrations/...sql) — only the SQL below.
 *
 * CLI (optional): from project root, `npx supabase db push` if migrations are linked.
 */

-- Public "receipts" bucket + RLS for order receipt uploads (Submit order in My Cart).

-- 1) Bucket: public so getPublicUrl() works without signed URLs
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

-- 2) Policies on storage.objects (RLS is on by default)

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
