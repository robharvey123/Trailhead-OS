-- ========================================
-- Calendar feeds (inbound iCal subscriptions)
-- ========================================
-- Allows subscribing to external calendar feeds (Apple, Outlook, any .ics URL)
-- Events pulled from these feeds are stored in calendar_events with a feed_id reference

create table if not exists calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  colour text default '#6366F1',
  enabled boolean default true,
  refresh_minutes int default 30,
  last_fetched_at timestamptz,
  last_error text,
  event_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table calendar_feeds enable row level security;
create policy "authenticated full access" on calendar_feeds
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ========================================
-- Extend google_tokens for multi-account support
-- ========================================
-- Add a label so Rob can name each connected Google account
alter table google_tokens add column if not exists label text;

-- ========================================
-- Google calendar selections
-- ========================================
-- Each Google account may have many calendars (personal, work, birthdays, etc.)
-- This table stores which ones to sync, plus display preferences

create table if not exists google_calendar_selections (
  id uuid primary key default gen_random_uuid(),
  google_token_id uuid not null references google_tokens(id) on delete cascade,
  gcal_calendar_id text not null,
  name text not null,
  colour text,
  enabled boolean default true,
  sync_direction text check (sync_direction in ('push', 'pull', 'both')) default 'pull',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (google_token_id, gcal_calendar_id)
);

alter table google_calendar_selections enable row level security;
create policy "authenticated full access" on google_calendar_selections
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ========================================
-- Extend calendar_events to track source
-- ========================================
-- source: 'manual' (created in app), 'google' (synced from Google), 'feed' (iCal subscription)
-- feed_id: links to calendar_feeds for iCal events
-- external_uid: unique UID from external source (iCal UID or Google event ID) to prevent duplicates

alter table calendar_events add column if not exists source text default 'manual'
  check (source in ('manual', 'google', 'feed'));
alter table calendar_events add column if not exists feed_id uuid references calendar_feeds(id) on delete cascade;
alter table calendar_events add column if not exists external_uid text;
alter table calendar_events add column if not exists read_only boolean default false;

-- Index for fast feed event lookups and deduplication
create index if not exists idx_calendar_events_feed_id on calendar_events(feed_id);
create index if not exists idx_calendar_events_external_uid on calendar_events(external_uid);
create index if not exists idx_calendar_events_source on calendar_events(source);

-- ========================================
-- Extend gcal_sync for multi-calendar support
-- ========================================
-- Link sync rows to the specific google_token_id so we know which account
alter table gcal_sync add column if not exists google_token_id uuid references google_tokens(id) on delete cascade;
