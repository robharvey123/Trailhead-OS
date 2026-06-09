-- ============================================================================
-- Meeting notes — Google Meet transcripts + Gemini "take notes for me" summaries,
-- matched to a CRM account / contact(s) / deal and anchored on the calendar event.
-- Source-agnostic (a Granola feed can write the same shape later). Transcripts are
-- sensitive → employee_rw RLS, consistent with accounts/contacts/deals.
-- ============================================================================

create table if not exists meeting_notes (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'google-meet' check (source in ('google-meet', 'granola')),
  -- Unique so a re-run dedupes on the calendar event (one note per meeting).
  calendar_event_id uuid unique references calendar_events(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  transcript text,
  summary jsonb, -- { summary, decisions[], nextSteps[], details }
  -- Stored so a re-match can re-run without re-hitting Google.
  attendee_emails text[] not null default '{}',
  match_confidence text not null default 'none'
    check (match_confidence in ('high', 'medium', 'low', 'none')),
  needs_review boolean not null default false,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Multi-contact link via a join table (codebase convention, cf. deal_projects).
create table if not exists meeting_notes_contacts (
  meeting_note_id uuid not null references meeting_notes(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  primary key (meeting_note_id, contact_id)
);

create index if not exists idx_meeting_notes_account on meeting_notes(account_id);
create index if not exists idx_meeting_notes_deal on meeting_notes(deal_id);
create index if not exists idx_meeting_notes_occurred on meeting_notes(occurred_at desc);
create index if not exists idx_meeting_notes_contacts_contact on meeting_notes_contacts(contact_id);

-- Shared updated_at trigger (same helper used across the OS tables).
drop trigger if exists meeting_notes_updated_at on meeting_notes;
create trigger meeting_notes_updated_at
  before update on meeting_notes
  for each row execute function update_workspace_updated_at();

-- RLS — employee_rw (owner/admin/employee), matching accounts/contacts/deals.
alter table meeting_notes enable row level security;
alter table meeting_notes_contacts enable row level security;

drop policy if exists meeting_notes_employee_rw on meeting_notes;
create policy meeting_notes_employee_rw on meeting_notes for all to authenticated
  using (is_employee()) with check (is_employee());

drop policy if exists meeting_notes_contacts_employee_rw on meeting_notes_contacts;
create policy meeting_notes_contacts_employee_rw on meeting_notes_contacts for all to authenticated
  using (is_employee()) with check (is_employee());
