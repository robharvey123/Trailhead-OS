-- ============================================================================
-- v4 Phase 8 — Approval requests. Additive, OS RLS pattern.
-- gmail_thread_id links a request to its sent email so inbound replies can
-- auto-flip the status (approved/declined heuristic).
-- ============================================================================
create table if not exists approval_requests (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements(id) on delete cascade,
  requester_id uuid references auth.users(id) on delete set null,
  approver_id uuid references contacts(id) on delete set null,
  type text not null check (type in ('hours_overage','slotting_fee','exhibition','travel','third_party')),
  amount numeric(12,2),
  currency text not null default 'GBP',
  description text,
  status text not null default 'Open' check (status in ('Open','Approved','Declined','Withdrawn')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decision_notes text,
  related_entity_type text check (related_entity_type in ('time_entry','invoice_line','expense','milestone')),
  related_entity_id uuid,
  gmail_thread_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_approval_requests_engagement on approval_requests (engagement_id);
create index if not exists idx_approval_requests_status on approval_requests (status);
create index if not exists idx_approval_requests_thread on approval_requests (gmail_thread_id);

alter table approval_requests enable row level security;
drop policy if exists approval_requests_authenticated_full_access on approval_requests;
create policy approval_requests_authenticated_full_access on approval_requests for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
