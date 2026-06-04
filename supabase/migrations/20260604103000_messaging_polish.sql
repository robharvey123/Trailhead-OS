-- ============================================================================
-- Messaging polish (brief 13): edit/delete within a 5-minute window (soft-delete
-- after), and live read receipts. Additive to brief 11; no schema break.
-- ============================================================================

alter table dm_messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

-- Soft-delete blanks the body, which would violate the original
-- length(body) between 1 and 4000 check. Relax it: empty body is allowed only
-- once the message is deleted; otherwise the 1..4000 bound still holds.
alter table dm_messages drop constraint if exists dm_messages_body_check;
alter table dm_messages add constraint dm_messages_body_check
  check (deleted_at is not null or length(body) between 1 and 4000);

-- Is a message still inside the edit/delete window? Evaluated server-side (now()).
create or replace function dm_message_within_window(p_created_at timestamptz)
returns boolean language sql stable as $$
  select p_created_at > (now() - interval '5 minutes');
$$;

-- Brief 11 had no UPDATE policy (messages immutable). One combined policy now
-- covers BOTH edit and soft-delete: sender-only, within the window. The body
-- wipe on delete happens through this same path.
drop policy if exists dm_msg_update on dm_messages;
create policy dm_msg_update on dm_messages for update
  using (sender_id = auth.uid() and dm_message_within_window(created_at))
  with check (sender_id = auth.uid());

-- Read receipts: a sender must see the RECIPIENT's read cursor. Brief 11's
-- dm_reads policy is self-only (write stays self-only); add a SELECT policy so
-- any conversation participant can read everyone's cursor for that conversation.
-- Only last_read_at timestamps are exposed — nothing sensitive.
drop policy if exists dm_reads_select on dm_reads;
create policy dm_reads_select on dm_reads for select
  using (is_in_conversation(conversation_id));

-- Live read indicator needs dm_reads in the realtime publication.
do $$ begin
  alter publication supabase_realtime add table dm_reads;
exception when duplicate_object then null; end $$;
