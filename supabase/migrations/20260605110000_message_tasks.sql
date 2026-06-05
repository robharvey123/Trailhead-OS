-- ============================================================================
-- Brief 16 (PR 2) — convert a chat message into a task + channel↔engagement link.
--
--  * engagement_tasks.source_message_id: back-pointer to the chat message a task
--    was created from, so the message can show "→ Created task X". ON DELETE SET
--    NULL — deleting a message doesn't delete the task it spawned.
--  * chat_conversations.default_engagement_id: a channel can be tied to a piece
--    of work, so converting a message there pre-selects that engagement.
--
-- Both reference existing RLS'd tables; no new policies needed (the task insert
-- is gated by the existing engagement_tasks_insert policy — reporter = me).
-- Idempotent / re-runnable.
-- ============================================================================

alter table engagement_tasks
  add column if not exists source_message_id uuid references chat_messages(id) on delete set null;

create index if not exists engagement_tasks_source_message_idx
  on engagement_tasks (source_message_id) where source_message_id is not null;

alter table chat_conversations
  add column if not exists default_engagement_id uuid references engagements(id) on delete set null;
