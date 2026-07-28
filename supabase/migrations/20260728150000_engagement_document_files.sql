-- ============================================================================
-- File uploads for engagement documents. The engagement_documents table already
-- holds markdown docs (weekly updates); add columns for uploaded files and a
-- private storage bucket, mirroring the receipts bucket pattern.
-- ============================================================================

alter table engagement_documents
  add column if not exists file_path text,   -- storage object path in engagement-docs
  add column if not exists file_name text,   -- original filename, for display + download
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint;

-- Private bucket for engagement documents.
insert into storage.buckets (id, name, public)
values ('engagement-docs', 'engagement-docs', false)
on conflict (id) do nothing;

drop policy if exists "authenticated can upload engagement docs" on storage.objects;
create policy "authenticated can upload engagement docs"
  on storage.objects for insert
  with check (bucket_id = 'engagement-docs' and auth.role() = 'authenticated');

drop policy if exists "authenticated can read engagement docs" on storage.objects;
create policy "authenticated can read engagement docs"
  on storage.objects for select
  using (bucket_id = 'engagement-docs' and auth.role() = 'authenticated');

drop policy if exists "authenticated can delete engagement docs" on storage.objects;
create policy "authenticated can delete engagement docs"
  on storage.objects for delete
  using (bucket_id = 'engagement-docs' and auth.role() = 'authenticated');
