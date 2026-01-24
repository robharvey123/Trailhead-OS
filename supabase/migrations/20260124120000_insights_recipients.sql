alter table workspace_settings
  add column if not exists insights_recipients text[] default '{}'::text[];
