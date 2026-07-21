-- ============================================================================
-- Granola meeting notes — synced from the official Granola API and matched to
-- CRM contacts/accounts by attendee email. Separate from the Google Meet
-- `meeting_notes` feature; this is the Granola-native surface.
-- Employee_rw RLS, consistent with accounts/contacts.
-- ============================================================================

create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  granola_note_id text unique not null,
  title text not null default '',
  summary_md text,
  meeting_date timestamptz,
  attendees jsonb not null default '[]',   -- [{name, email}]
  account_id uuid references accounts(id) on delete set null,
  -- Granola's note updated_at, stored so the sync can skip unchanged notes.
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists meeting_contacts (
  meeting_id uuid references meetings(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  primary key (meeting_id, contact_id)
);

create index if not exists idx_meetings_account on meetings(account_id);
create index if not exists idx_meetings_date on meetings(meeting_date desc);
create index if not exists idx_meeting_contacts_contact on meeting_contacts(contact_id);

-- Shared updated_at trigger (same helper used across the OS tables).
drop trigger if exists meetings_updated_at on meetings;
create trigger meetings_updated_at
  before update on meetings
  for each row execute function update_workspace_updated_at();

-- RLS — employee_rw (owner/admin/employee), matching accounts/contacts.
alter table meetings enable row level security;
alter table meeting_contacts enable row level security;

drop policy if exists meetings_employee_rw on meetings;
create policy meetings_employee_rw on meetings for all to authenticated
  using (is_employee()) with check (is_employee());

drop policy if exists meeting_contacts_employee_rw on meeting_contacts;
create policy meeting_contacts_employee_rw on meeting_contacts for all to authenticated
  using (is_employee()) with check (is_employee());
