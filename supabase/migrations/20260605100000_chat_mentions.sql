-- ============================================================================
-- Brief 16 (PR 1) — @name mentions in chat.
--
-- Mentions are stored structurally, one row per (message, mentioned person).
-- They reference people.id (the canonical identity) — NOT auth users — so a
-- mention works even for a person with no auth login yet. A mentioned person is
-- only *notified* (badged) if their auth_user_id is a participant of the
-- conversation; the row renders either way.
--
-- The composer is the source of truth for what's a mention: the server persists
-- exactly the person_ids it's handed (after validating they exist), it does NOT
-- parse @text out of the body.
--
-- Idempotent / re-runnable.
-- (The message→task backlink — engagement_tasks.source_message_id — and channel
--  default_engagement_id land in PR 2 with the convert-to-task flow.)
-- ============================================================================

create table if not exists chat_message_mentions (
  message_id uuid not null references chat_messages(id) on delete cascade,
  mentioned_person_id uuid not null references people(id) on delete cascade,
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, mentioned_person_id)
);

create index if not exists idx_chat_mentions_person on chat_message_mentions (mentioned_person_id, created_at desc);
create index if not exists idx_chat_mentions_conv on chat_message_mentions (conversation_id);

alter table chat_message_mentions enable row level security;

-- Read: visible if you can see the conversation (a participant of it).
drop policy if exists mentions_select on chat_message_mentions;
create policy mentions_select on chat_message_mentions for select
  using (is_chat_participant(conversation_id));

-- Insert: must be a participant AND must own the message being annotated.
drop policy if exists mentions_insert on chat_message_mentions;
create policy mentions_insert on chat_message_mentions for insert
  with check (
    is_chat_participant(conversation_id)
    and exists (
      select 1 from chat_messages m
      where m.id = message_id and m.sender_id = auth.uid()
    )
  );

-- Delete: the message owner may remove a mention (used when an edit drops one).
-- No update — a mention is created or deleted, never mutated in place.
drop policy if exists mentions_delete on chat_message_mentions;
create policy mentions_delete on chat_message_mentions for delete
  using (
    exists (
      select 1 from chat_messages m
      where m.id = message_id and m.sender_id = auth.uid()
    )
  );

-- Realtime so recipients see a mention appear without a refetch.
do $$ begin
  alter publication supabase_realtime add table chat_message_mentions;
exception when duplicate_object then null; end $$;
