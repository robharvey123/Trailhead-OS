-- ============================================================================
-- Email inbox — extend email_logs for the /inbox UI (extend-existing approach).
-- Additive only; email_logs is currently empty (zero data risk).
-- ============================================================================

alter table email_logs
  add column if not exists cc_addresses text[] not null default '{}',
  add column if not exists bcc_addresses text[] not null default '{}',
  add column if not exists body_text text,
  add column if not exists is_unread boolean not null default false,
  add column if not exists is_starred boolean not null default false,
  add column if not exists labels text[] not null default '{}',
  add column if not exists match_method text,        -- 'contact_email' | 'domain' | 'manual' | 'unmatched'
  add column if not exists from_name text;

create index if not exists idx_email_logs_thread on email_logs (gmail_thread_id);
create index if not exists idx_email_logs_unread on email_logs (is_unread) where is_unread = true;
create index if not exists idx_email_logs_received on email_logs (received_at desc);
