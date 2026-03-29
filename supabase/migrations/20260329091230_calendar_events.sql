create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean default false,
  workstream_id uuid references workstreams(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  location text,
  colour text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table calendar_events enable row level security;

create policy "authenticated full access" on calendar_events
  for all using (auth.role() = 'authenticated');
