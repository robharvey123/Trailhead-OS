-- Many-to-many meeting ↔ account links, so a meeting can be tied to several
-- accounts (and edited manually), alongside the existing meeting_contacts join.
-- meetings.account_id stays as the "primary" account (auto-linked, backward compat);
-- this table is the full, editable set and is backfilled from it.

create table if not exists meeting_accounts (
  meeting_id uuid not null references meetings(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meeting_id, account_id)
);
create index if not exists idx_meeting_accounts_account on meeting_accounts (account_id);

insert into meeting_accounts (meeting_id, account_id)
  select id, account_id from meetings where account_id is not null
  on conflict do nothing;

alter table meeting_accounts enable row level security;
drop policy if exists meeting_accounts_authenticated_full_access on meeting_accounts;
create policy meeting_accounts_authenticated_full_access on meeting_accounts for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
