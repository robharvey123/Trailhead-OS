create table if not exists google_tokens (
  id uuid primary key default gen_random_uuid(),
  access_token text not null,
  refresh_token text not null,
  token_type text default 'Bearer',
  expiry_date bigint,
  scope text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table google_tokens enable row level security;

drop policy if exists "authenticated full access" on google_tokens;
create policy "authenticated full access" on google_tokens
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create table if not exists email_logs (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text unique,
  gmail_thread_id text,
  account_id uuid references accounts(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  enquiry_id uuid references enquiries(id) on delete set null,
  quote_id uuid references quotes(id) on delete set null,
  direction text check (direction in ('inbound', 'outbound')),
  from_address text,
  to_addresses text[],
  subject text,
  snippet text,
  body_html text,
  received_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz default now()
);

alter table email_logs enable row level security;

drop policy if exists "authenticated full access" on email_logs;
create policy "authenticated full access" on email_logs
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create table if not exists gcal_sync (
  id uuid primary key default gen_random_uuid(),
  calendar_event_id uuid references calendar_events(id) on delete cascade,
  gcal_event_id text unique,
  gcal_calendar_id text default 'primary',
  last_synced_at timestamptz default now(),
  sync_direction text check (sync_direction in ('push', 'pull', 'both')),
  created_at timestamptz default now()
);

alter table gcal_sync enable row level security;

drop policy if exists "authenticated full access" on gcal_sync;
create policy "authenticated full access" on gcal_sync
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create table if not exists stripe_customers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  stripe_customer_id text unique not null,
  stripe_subscription_id text,
  subscription_status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table stripe_customers enable row level security;

drop policy if exists "authenticated full access" on stripe_customers;
create policy "authenticated full access" on stripe_customers
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

alter table invoices
  add column if not exists stripe_payment_link text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_session_id text,
  add column if not exists paid_at timestamptz;

alter table invoices
  add column if not exists is_recurring boolean default false,
  add column if not exists recurring_interval text
    check (recurring_interval in ('month', 'year'));

create index if not exists idx_google_tokens_email on google_tokens(email);
create index if not exists idx_email_logs_account_id on email_logs(account_id);
create index if not exists idx_email_logs_contact_id on email_logs(contact_id);
create index if not exists idx_email_logs_enquiry_id on email_logs(enquiry_id);
create index if not exists idx_email_logs_quote_id on email_logs(quote_id);
create index if not exists idx_email_logs_received_at on email_logs(received_at desc);
create index if not exists idx_email_logs_sent_at on email_logs(sent_at desc);
create index if not exists idx_gcal_sync_calendar_event_id on gcal_sync(calendar_event_id);
create index if not exists idx_gcal_sync_last_synced_at on gcal_sync(last_synced_at desc);
create index if not exists idx_stripe_customers_account_id on stripe_customers(account_id);
create index if not exists idx_stripe_customers_contact_id on stripe_customers(contact_id);
create index if not exists idx_stripe_customers_subscription_status on stripe_customers(subscription_status);

drop trigger if exists google_tokens_updated_at on google_tokens;
create trigger google_tokens_updated_at
  before update on google_tokens
  for each row execute function update_workspace_updated_at();

drop trigger if exists stripe_customers_updated_at on stripe_customers;
create trigger stripe_customers_updated_at
  before update on stripe_customers
  for each row execute function update_workspace_updated_at();
