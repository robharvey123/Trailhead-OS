-- Interactive client quote page ("Proposal").
-- Additive only: new nullable/defaulted columns on quotes, two new tables.
-- Public access is service-role only, in server code (lib/quotes/public.ts and
-- app/api/proposal/*). There is deliberately NO anon policy on quotes or on
-- either new table.

-- 1. Share + internal notes on quotes (existing rows untouched)
alter table quotes
  add column if not exists public_token text unique,
  add column if not exists published_at timestamptz,
  add column if not exists internal_notes text,
  add column if not exists first_viewed_at timestamptz,
  add column if not exists last_viewed_at timestamptz,
  add column if not exists view_count integer not null default 0;

comment on column quotes.notes is
  'CLIENT-FACING. Rendered on the public proposal page and PDF. Private remarks go in internal_notes.';
comment on column quotes.internal_notes is
  'INTERNAL ONLY. Never selected by the public projection.';

-- 2. Acceptance record: immutable evidence of what was agreed
create table if not exists quote_acceptances (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  quote_version integer not null,
  quote_updated_at timestamptz not null,
  signer_name text not null,
  signer_email text not null,
  signer_role text,
  selected_line_item_ids jsonb not null,
  snapshot jsonb not null,          -- the full PublicQuote as shown, plus selection
  subtotal numeric not null,
  vat_amount numeric not null,
  total numeric not null,
  ip text,
  user_agent text,
  meta jsonb not null default '{}', -- e.g. { "manual": true } for OS-recorded acceptances
  accepted_at timestamptz not null default now()
);
create unique index if not exists uq_quote_acceptances_quote on quote_acceptances(quote_id);

-- 3. Activity trail
create table if not exists quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  type text not null check (type in (
    'published','revoked','viewed','pdf_downloaded','question','accepted','declined'
  )),
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_quote_events_quote_created on quote_events(quote_id, created_at desc);

-- 4. RLS: the same pair quotes and quote_versions carry today
--    (20260604090100_rls_lockdown.sql + 20261023110000_sales_access.sql):
--    permissive <table>_employee_rw and restrictive <table>_deny_sales.
alter table quote_acceptances enable row level security;
alter table quote_events enable row level security;

drop policy if exists quote_acceptances_employee_rw on quote_acceptances;
create policy quote_acceptances_employee_rw on quote_acceptances
  for all to authenticated using (is_employee()) with check (is_employee());

drop policy if exists quote_acceptances_deny_sales on quote_acceptances;
create policy quote_acceptances_deny_sales on quote_acceptances
  as restrictive for all to authenticated
  using (not public.is_sales()) with check (not public.is_sales());

drop policy if exists quote_events_employee_rw on quote_events;
create policy quote_events_employee_rw on quote_events
  for all to authenticated using (is_employee()) with check (is_employee());

drop policy if exists quote_events_deny_sales on quote_events;
create policy quote_events_deny_sales on quote_events
  as restrictive for all to authenticated
  using (not public.is_sales()) with check (not public.is_sales());
