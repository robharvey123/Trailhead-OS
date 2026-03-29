create extension if not exists "pgcrypto";

create table report_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  token text unique not null default replace(gen_random_uuid()::text, '-', ''),
  label text,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz default now()
);

alter table report_tokens enable row level security;

create policy "authenticated can manage tokens" on report_tokens
  for all using (auth.role() = 'authenticated');

create policy "public can read token by value" on report_tokens
  for select using (true);
