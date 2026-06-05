-- ============================================================================
-- Brief 17 — Web Push (VAPID) subscriptions + per-user notification settings.
--
-- One row per browser/endpoint, scoped to the auth user. Re-subscribing the same
-- browser yields the same endpoint → upsert overwrites the keys (see the
-- subscribe route's on-conflict). Dead endpoints (404/410 from the push service)
-- are deleted by the dispatcher, not here.
-- Idempotent / re-runnable.
-- ============================================================================

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists idx_push_subscriptions_user on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- A user only ever sees/writes their own subscriptions. The dispatcher reads
-- across users via the service role (RLS-bypassing), where it sends pushes.
drop policy if exists push_sub_self on push_subscriptions;
create policy push_sub_self on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Per-user category toggles. JSON keeps the schema flat at this scope.
alter table profiles
  add column if not exists notification_settings jsonb not null default '{
    "push_direct_message": true,
    "push_mention": true,
    "push_task_assigned": true
  }'::jsonb;
