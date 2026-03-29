create table touchpoints (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  type text not null check (type in ('call', 'email', 'message', 'meeting', 'note')),
  subject text not null,
  body text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint touchpoints_account_or_contact check (account_id is not null or contact_id is not null)
);

create index idx_touchpoints_account_id on touchpoints(account_id);
create index idx_touchpoints_contact_id on touchpoints(contact_id);
create index idx_touchpoints_occurred_at on touchpoints(occurred_at desc);

alter table touchpoints enable row level security;

create policy "authenticated full access" on touchpoints
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop trigger if exists touchpoints_updated_at on touchpoints;
create trigger touchpoints_updated_at
  before update on touchpoints
  for each row execute function update_workspace_updated_at();
