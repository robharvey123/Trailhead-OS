-- ========================================
-- Microsoft Exchange / Outlook calendar integration
-- ========================================
-- Stores OAuth2 tokens for Microsoft 365 / Outlook.com accounts
-- and tracks which calendars to sync via Microsoft Graph API

-- Microsoft OAuth tokens (mirrors google_tokens pattern)
create table if not exists microsoft_tokens (
  id uuid primary key default gen_random_uuid(),
  access_token text not null,
  refresh_token text not null,
  token_type text default 'Bearer',
  expiry_date bigint,
  scope text,
  email text,
  label text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table microsoft_tokens enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'microsoft_tokens' and policyname = 'authenticated full access'
  ) then
    create policy "authenticated full access" on microsoft_tokens
      for all using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

-- Microsoft calendar selections (mirrors google_calendar_selections pattern)
create table if not exists microsoft_calendar_selections (
  id uuid primary key default gen_random_uuid(),
  microsoft_token_id uuid not null references microsoft_tokens(id) on delete cascade,
  ms_calendar_id text not null,
  name text not null,
  colour text,
  enabled boolean default true,
  sync_direction text check (sync_direction in ('push', 'pull', 'both')) default 'pull',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (microsoft_token_id, ms_calendar_id)
);

alter table microsoft_calendar_selections enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'microsoft_calendar_selections' and policyname = 'authenticated full access'
  ) then
    create policy "authenticated full access" on microsoft_calendar_selections
      for all using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

-- Microsoft sync tracking (mirrors gcal_sync pattern)
create table if not exists ms_cal_sync (
  id uuid primary key default gen_random_uuid(),
  calendar_event_id uuid not null references calendar_events(id) on delete cascade,
  ms_event_id text not null,
  ms_calendar_id text,
  microsoft_token_id uuid references microsoft_tokens(id) on delete cascade,
  last_synced_at timestamptz default now(),
  sync_direction text check (sync_direction in ('push', 'pull', 'both')) default 'pull'
);

alter table ms_cal_sync enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'ms_cal_sync' and policyname = 'authenticated full access'
  ) then
    create policy "authenticated full access" on ms_cal_sync
      for all using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

-- Extend calendar_events source to include 'microsoft'
alter table calendar_events drop constraint if exists calendar_events_source_check;
alter table calendar_events add constraint calendar_events_source_check
  check (source in ('manual', 'google', 'feed', 'microsoft'));

-- Indexes
create index if not exists idx_microsoft_tokens_email on microsoft_tokens(email);
create index if not exists idx_ms_cal_sync_ms_event_id on ms_cal_sync(ms_event_id);
create index if not exists idx_ms_cal_sync_calendar_event_id on ms_cal_sync(calendar_event_id);

-- Auto-update timestamp trigger (reuse existing function)
drop trigger if exists microsoft_tokens_updated_at on microsoft_tokens;
create trigger microsoft_tokens_updated_at
  before update on microsoft_tokens
  for each row execute function update_workspace_updated_at();
