-- ============================================================================
-- Brief 15: file attachments + full-text search on the unified chat model.
-- Additive to brief 14. Idempotent.
-- ============================================================================

create table if not exists chat_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references chat_messages(id) on delete cascade,
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  storage_path text not null,             -- {conversation_id}/{uuid}-{filename}
  file_name text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 26214400), -- 25 MB
  width integer,
  height integer,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_att_message on chat_attachments (message_id);
create index if not exists idx_chat_att_conversation on chat_attachments (conversation_id);

alter table chat_attachments enable row level security;

drop policy if exists chat_att_select on chat_attachments;
create policy chat_att_select on chat_attachments for select
  using (is_chat_participant(conversation_id));

drop policy if exists chat_att_insert on chat_attachments;
create policy chat_att_insert on chat_attachments for insert
  with check (
    is_chat_participant(conversation_id)
    and uploaded_by = auth.uid()
    and exists (select 1 from chat_messages m where m.id = message_id and m.sender_id = auth.uid())
  );
-- No update; delete cascades from chat_messages.

-- Full-text search: generated stored tsvector + GIN index (no trigger needed).
alter table chat_messages
  add column if not exists body_tsv tsvector
    generated always as (to_tsvector('english', coalesce(body, ''))) stored;
create index if not exists chat_messages_body_tsv_idx on chat_messages using gin (body_tsv);

do $$ begin alter publication supabase_realtime add table chat_attachments; exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Storage bucket + object policies.
-- Path convention: {conversation_id}/{uuid}-{filename}. A guarded helper turns
-- the first path segment into a uuid (or null for non-conforming names) so the
-- policy never errors on objects in OTHER buckets — RLS AND isn't guaranteed to
-- short-circuit a raw ::uuid cast.
-- ---------------------------------------------------------------------------
create or replace function chat_path_conv(p_name text)
returns uuid language sql immutable as $$
  select case
    when p_name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/'
    then split_part(p_name, '/', 1)::uuid
    else null
  end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments', 'chat-attachments', false, 26214400,
  array[
    'image/png','image/jpeg','image/gif','image/webp',
    'application/pdf',
    'text/plain','text/csv','text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip'
  ]
)
on conflict (id) do nothing;

drop policy if exists chat_att_read on storage.objects;
create policy chat_att_read on storage.objects for select
  using (bucket_id = 'chat-attachments' and is_chat_participant(chat_path_conv(name)));

drop policy if exists chat_att_upload on storage.objects;
create policy chat_att_upload on storage.objects for insert
  with check (bucket_id = 'chat-attachments' and owner = auth.uid() and is_chat_participant(chat_path_conv(name)));

drop policy if exists chat_att_delete on storage.objects;
create policy chat_att_delete on storage.objects for delete
  using (bucket_id = 'chat-attachments' and (owner = auth.uid() or is_chat_admin(chat_path_conv(name))));
