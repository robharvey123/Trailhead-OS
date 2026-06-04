-- ============================================================================
-- In-app 1:1 direct messaging (brief: live messaging).
-- Conversations are between exactly two auth users; messages are immutable in
-- v1; per-user read cursors drive unread counts. Realtime publication lets the
-- browser subscribe to new messages. Idempotent throughout (re-runnable).
-- ============================================================================

-- Conversations: exactly two users, canonical order (smaller uuid first) so a
-- pair can only ever have one conversation row.
create table if not exists dm_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references auth.users(id) on delete cascade,
  user_b_id uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint dm_user_order check (user_a_id < user_b_id),
  unique (user_a_id, user_b_id)
);
create index if not exists idx_dm_conv_a on dm_conversations (user_a_id, last_message_at desc);
create index if not exists idx_dm_conv_b on dm_conversations (user_b_id, last_message_at desc);

create table if not exists dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references dm_conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists idx_dm_msg_conv on dm_messages (conversation_id, created_at desc);

create table if not exists dm_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references dm_conversations(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

-- Bump conversation.last_message_at on every new message (drives list ordering).
create or replace function bump_conversation_on_message()
returns trigger language plpgsql as $$
begin
  update dm_conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists dm_messages_bump on dm_messages;
create trigger dm_messages_bump
  after insert on dm_messages
  for each row execute function bump_conversation_on_message();

-- SECURITY DEFINER so the inner select bypasses RLS (avoids policy recursion).
create or replace function is_in_conversation(p_conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from dm_conversations
    where id = p_conv and (user_a_id = auth.uid() or user_b_id = auth.uid())
  );
$$;

-- Minimal user directory for messaging: id + canonical display name only.
-- profiles RLS is admin-or-self, so a non-admin can't list/resolve other users;
-- this definer function exposes ONLY id + name (not role / person_id) to any
-- authenticated user, which is what the picker + conversation list need.
create or replace function dm_directory()
returns table (id uuid, display_name text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(pe.full_name, p.display_name, 'User') as display_name
  from profiles p
  left join people pe on pe.id = p.person_id
  order by 2;
$$;
revoke all on function dm_directory() from public;
grant execute on function dm_directory() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — every read/write scoped to participants.
-- ---------------------------------------------------------------------------
alter table dm_conversations enable row level security;
alter table dm_messages enable row level security;
alter table dm_reads enable row level security;

drop policy if exists dm_conv_select on dm_conversations;
create policy dm_conv_select on dm_conversations for select
  using (user_a_id = auth.uid() or user_b_id = auth.uid());

drop policy if exists dm_conv_insert on dm_conversations;
create policy dm_conv_insert on dm_conversations for insert
  with check (user_a_id = auth.uid() or user_b_id = auth.uid());

drop policy if exists dm_msg_select on dm_messages;
create policy dm_msg_select on dm_messages for select
  using (is_in_conversation(conversation_id));

drop policy if exists dm_msg_insert on dm_messages;
create policy dm_msg_insert on dm_messages for insert
  with check (sender_id = auth.uid() and is_in_conversation(conversation_id));

drop policy if exists dm_reads_self on dm_reads;
create policy dm_reads_self on dm_reads for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime — required for postgres_changes subscriptions to fire.
-- ---------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table dm_messages;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table dm_conversations;
exception when duplicate_object then null; end $$;
