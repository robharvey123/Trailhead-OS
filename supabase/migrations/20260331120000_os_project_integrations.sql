alter table projects
add column if not exists owner_id uuid references auth.users(id) on delete set null;

alter table calendar_events
add column if not exists project_id uuid references projects(id) on delete set null;

create table if not exists project_contacts (
  project_id uuid not null references projects(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  relationship_role text,
  created_at timestamptz default now(),
  primary key (project_id, contact_id)
);

create index if not exists idx_projects_owner_id on projects(owner_id);
create index if not exists idx_calendar_events_project_id on calendar_events(project_id);
create index if not exists idx_project_contacts_contact_id on project_contacts(contact_id);

alter table project_contacts enable row level security;

drop policy if exists "authenticated full access" on project_contacts;
create policy "authenticated full access" on project_contacts
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');