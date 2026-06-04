-- ============================================================================
-- Unified chat model (brief 14): one conversation type for both DMs and named
-- channels, distinguished by `kind`, with a participants table. Migrates the
-- brief 11/13 dm_* data in. The old dm_* tables are intentionally LEFT IN PLACE
-- as a safety net (only 1 row each) — a follow-up migration can drop them once
-- the new model is verified in production.
-- Idempotent: re-runnable (guarded creates + on-conflict-do-nothing copies).
-- ============================================================================

do $$ begin
  create type chat_kind as enum ('dm', 'channel');
exception when duplicate_object then null; end $$;

create table if not exists chat_conversations (
  id uuid primary key default gen_random_uuid(),
  kind chat_kind not null,
  name text,
  created_by uuid references auth.users(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chat_name_for_channels check (
    (kind = 'dm' and name is null) or
    (kind = 'channel' and name is not null and length(name) between 1 and 100)
  )
);

create table if not exists chat_participants (
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists idx_chat_part_user on chat_participants (user_id, conversation_id);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  body text not null check (length(body) between 0 and 4000), -- 0 allows deleted-blanked body
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_msg_conv on chat_messages (conversation_id, created_at desc);

create or replace function chat_bump_conversation()
returns trigger language plpgsql as $$
begin
  update chat_conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end $$;
drop trigger if exists chat_messages_bump on chat_messages;
create trigger chat_messages_bump after insert on chat_messages for each row execute function chat_bump_conversation();

-- Realtime
do $$ begin alter publication supabase_realtime add table chat_messages; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table chat_conversations; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table chat_participants; exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- RLS — all reads/writes scoped via the participants table. SECURITY DEFINER
-- helpers query chat_participants from inside policies without recursing.
-- Conversation/participant CREATE is done server-side with the service role
-- (see actions.ts), so the participant INSERT policy can stay strict here.
-- ---------------------------------------------------------------------------
create or replace function is_chat_participant(p_conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from chat_participants where conversation_id = p_conv and user_id = auth.uid());
$$;

create or replace function is_chat_admin(p_conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from chat_participants where conversation_id = p_conv and user_id = auth.uid() and role = 'admin');
$$;

alter table chat_conversations enable row level security;
alter table chat_participants enable row level security;
alter table chat_messages enable row level security;

drop policy if exists chat_conv_select on chat_conversations;
create policy chat_conv_select on chat_conversations for select using (is_chat_participant(id));
drop policy if exists chat_conv_insert on chat_conversations;
create policy chat_conv_insert on chat_conversations for insert with check (created_by = auth.uid());

drop policy if exists chat_part_select on chat_participants;
create policy chat_part_select on chat_participants for select using (is_chat_participant(conversation_id));
drop policy if exists chat_part_insert on chat_participants;
create policy chat_part_insert on chat_participants for insert with check (is_chat_admin(conversation_id));
drop policy if exists chat_part_delete on chat_participants;
create policy chat_part_delete on chat_participants for delete using (is_chat_admin(conversation_id) or user_id = auth.uid());
drop policy if exists chat_part_update_self on chat_participants;
create policy chat_part_update_self on chat_participants for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists chat_msg_select on chat_messages;
create policy chat_msg_select on chat_messages for select using (is_chat_participant(conversation_id));
drop policy if exists chat_msg_insert on chat_messages;
create policy chat_msg_insert on chat_messages for insert with check (sender_id = auth.uid() and is_chat_participant(conversation_id));
drop policy if exists chat_msg_update on chat_messages;
create policy chat_msg_update on chat_messages for update
  using (sender_id = auth.uid() and created_at > now() - interval '5 minutes')
  with check (sender_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Data migration from dm_* (idempotent). IDs are preserved so links survive.
-- ---------------------------------------------------------------------------
insert into chat_conversations (id, kind, name, created_by, last_message_at, created_at)
select id, 'dm'::chat_kind, null, null, last_message_at, created_at
from dm_conversations
on conflict (id) do nothing;

insert into chat_participants (conversation_id, user_id, role, joined_at, last_read_at)
select c.id, c.user_a_id, 'member', c.created_at,
       coalesce((select r.last_read_at from dm_reads r where r.user_id = c.user_a_id and r.conversation_id = c.id), c.created_at)
from dm_conversations c
union all
select c.id, c.user_b_id, 'member', c.created_at,
       coalesce((select r.last_read_at from dm_reads r where r.user_id = c.user_b_id and r.conversation_id = c.id), c.created_at)
from dm_conversations c
on conflict (conversation_id, user_id) do nothing;

insert into chat_messages (id, conversation_id, sender_id, body, edited_at, deleted_at, created_at)
select id, conversation_id, sender_id, body, edited_at, deleted_at, created_at
from dm_messages
on conflict (id) do nothing;
