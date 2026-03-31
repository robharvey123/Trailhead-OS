alter table enquiries
  add column if not exists project_id uuid references projects(id) on delete set null;

alter table quotes
  add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists idx_enquiries_project_id on enquiries(project_id);
create index if not exists idx_quotes_project_id on quotes(project_id);