-- Scheduled outbound email. The payload carries everything the send function
-- needs; the cron claims due rows optimistically (pending → sending) before
-- sending so a slow Gmail call can't be double-sent by the next 5-min tick.
create table if not exists scheduled_emails (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,          -- {to, cc, bcc, subject, body_html, attachments, in_reply_to?, account_id?, contact_id?}
  send_at timestamptz not null,
  status text not null default 'pending',  -- pending | sending | sent | failed | cancelled
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_scheduled_emails_due on scheduled_emails (send_at) where status = 'pending';

alter table scheduled_emails enable row level security;

-- Email infrastructure — admin-only, matching email_logs.
drop policy if exists scheduled_emails_admin_rw on scheduled_emails;
create policy scheduled_emails_admin_rw on scheduled_emails for all to authenticated
  using (is_admin()) with check (is_admin());
