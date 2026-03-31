alter table enquiries
  add column if not exists internal_notes text,
  add column if not exists internal_notes_updated_at timestamptz,
  add column if not exists internal_notes_author_id uuid references auth.users(id) on delete set null;

alter table enquiries
  drop constraint if exists enquiries_status_check;

alter table enquiries
  add constraint enquiries_status_check check (
    status in ('new', 'reviewed', 'converted', 'received', 'under_review', 'quoted', 'closed')
  );

alter table quotes
  add column if not exists draft_content jsonb,
  add column if not exists final_content jsonb,
  add column if not exists version integer not null default 1,
  add column if not exists generated_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists created_by_id uuid references auth.users(id) on delete set null;

alter table quotes
  drop constraint if exists quotes_status_check;

alter table quotes
  add constraint quotes_status_check check (
    status in ('draft', 'review', 'sent', 'accepted', 'rejected', 'declined', 'expired', 'converted')
  );

create table if not exists quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  version integer not null,
  content jsonb not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table quote_versions enable row level security;

drop policy if exists "authenticated full access" on quote_versions;
create policy "authenticated full access" on quote_versions
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create index if not exists idx_enquiries_internal_notes_author_id on enquiries(internal_notes_author_id);
create index if not exists idx_enquiries_status_created_at on enquiries(status, created_at desc);
create index if not exists idx_quotes_sent_at on quotes(sent_at desc);
create index if not exists idx_quotes_created_by_id on quotes(created_by_id);
create index if not exists idx_quote_versions_quote_id_version on quote_versions(quote_id, version desc);