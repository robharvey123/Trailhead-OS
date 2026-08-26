-- ============================================================================
-- WhatsApp conversations, participants and messages.
--
-- Messages belong to a CONVERSATION (1:1 or group), not to a contact. Each
-- message has a sender participant; a participant may or may not be mapped to a
-- CRM contact (unmapped is a first-class state — "Steve" with no surname yet).
--
-- Fed by phone chat exports (manual_import / personal_export) and by live capture
-- from Cowork (cowork_capture). The Cloud API is blocked by Meta; if it ever
-- opens, wa_chat_id / wa_id are populated with no schema change.
--
-- client_visible defaults false everywhere and has no write path on the Cowork
-- POST endpoint: private commercial chat must never reach a client PDF by
-- accident. Employee_rw RLS, matching accounts/contacts/meetings.
-- ============================================================================

create table if not exists whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  wa_chat_id text unique,               -- null for imports; real ID only if the API ever opens
  title text not null,                  -- 'QOLA UK development'
  is_group boolean not null default false,
  account_id uuid references accounts(id) on delete set null,
  engagement_id uuid references engagements(id) on delete set null,
  is_personal boolean not null default false,
  client_visible boolean not null default false,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wa_conversations_account on whatsapp_conversations (account_id);
create index if not exists idx_wa_conversations_engagement on whatsapp_conversations (engagement_id);
create index if not exists idx_wa_conversations_title on whatsapp_conversations (lower(title));

create table if not exists whatsapp_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references whatsapp_conversations(id) on delete cascade,
  display_name text not null,           -- as it appears in the export, minus the '~' unsaved-number prefix
  normalised_name text not null,        -- lower, trimmed, '~' and invisible marks stripped, whitespace collapsed
  contact_id uuid references contacts(id) on delete set null,   -- nullable: unmapped is valid
  is_self boolean not null default false,
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  unique (conversation_id, normalised_name)
);

create index if not exists idx_wa_participants_contact on whatsapp_participants (contact_id);
create index if not exists idx_wa_participants_conversation on whatsapp_participants (conversation_id);

create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  -- Synthetic for imports ('import_' + sha256) and live capture ('cw:' + sha256).
  -- Real WhatsApp IDs only if the API ever opens.
  wa_message_id text unique not null,
  conversation_id uuid not null references whatsapp_conversations(id) on delete cascade,
  sender_participant_id uuid references whatsapp_participants(id) on delete set null,
  -- Derived: outbound when the sender participant is_self. Kept for legacy readers.
  direction text not null check (direction in ('inbound','outbound')),
  wa_id text,                       -- null for imports: exports carry no phone number
  display_name text,                -- sender name as it appeared at import time
  -- Denormalised copy of the sender's mapped contact / the conversation's account.
  -- Nothing new should read these; go via the participant / conversation.
  contact_id uuid references contacts(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  engagement_id uuid references engagements(id) on delete set null,
  type text not null default 'text' check (type in ('text','media','system')),
  body text,
  media_filename text,              -- filename only in v1, no bytes
  source text not null default 'manual_import'
    check (source in ('business_api','history_backfill','manual_import','personal_export','cowork_capture')),
  is_personal boolean not null default false,
  client_visible boolean not null default false,
  is_draft boolean not null default false,
  occurred_at timestamptz not null,
  occurred_at_precision text not null default 'exact'
    check (occurred_at_precision in ('exact','minute','day')),
  revoked_at timestamptz,
  import_batch_id uuid,             -- lets a bad import be deleted in one statement
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wa_messages_conversation on whatsapp_messages (conversation_id, occurred_at desc);
create index if not exists idx_wa_messages_engagement on whatsapp_messages (engagement_id, occurred_at desc);
create index if not exists idx_wa_messages_contact on whatsapp_messages (contact_id, occurred_at desc);
create index if not exists idx_wa_messages_account on whatsapp_messages (account_id, occurred_at desc);
create index if not exists idx_wa_messages_batch on whatsapp_messages (import_batch_id);
create index if not exists idx_wa_messages_sender on whatsapp_messages (sender_participant_id);

-- Shared updated_at trigger (same helper used across the OS tables).
drop trigger if exists whatsapp_conversations_updated_at on whatsapp_conversations;
create trigger whatsapp_conversations_updated_at
  before update on whatsapp_conversations
  for each row execute function update_workspace_updated_at();

drop trigger if exists whatsapp_messages_updated_at on whatsapp_messages;
create trigger whatsapp_messages_updated_at
  before update on whatsapp_messages
  for each row execute function update_workspace_updated_at();

-- RLS — employee_rw (owner/admin/employee).
alter table whatsapp_conversations enable row level security;
alter table whatsapp_participants enable row level security;
alter table whatsapp_messages enable row level security;

drop policy if exists whatsapp_conversations_employee_rw on whatsapp_conversations;
create policy whatsapp_conversations_employee_rw on whatsapp_conversations for all to authenticated
  using (is_employee()) with check (is_employee());

drop policy if exists whatsapp_participants_employee_rw on whatsapp_participants;
create policy whatsapp_participants_employee_rw on whatsapp_participants for all to authenticated
  using (is_employee()) with check (is_employee());

drop policy if exists whatsapp_messages_employee_rw on whatsapp_messages;
create policy whatsapp_messages_employee_rw on whatsapp_messages for all to authenticated
  using (is_employee()) with check (is_employee());
