-- ============================================================================
-- Brief 8 — roadmap document → tasks. Stores each import (raw LLM output + the
-- user-edited committed state) for audit, and a private storage bucket for the
-- source file. project_id → projects (shape A: projects.engagement_id resolves
-- the engagement that owns the committed engagement_tasks). Admin-only for v1.
-- ============================================================================

create table if not exists roadmap_imports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  engagement_id uuid references engagements(id) on delete set null,
  source_filename text not null,
  source_file_path text,                 -- path in the roadmap-imports storage bucket
  extracted_json jsonb not null,         -- raw LLM output, before user edits
  committed_json jsonb,                  -- final edited state; null until commit
  status text not null default 'pending' check (status in ('pending', 'committed', 'discarded')),
  task_count_committed int,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  committed_at timestamptz
);

create index if not exists idx_roadmap_imports_project on roadmap_imports (project_id, created_at desc);

alter table roadmap_imports enable row level security;

drop policy if exists roadmap_imports_admin on roadmap_imports;
create policy roadmap_imports_admin on roadmap_imports for all
  using (is_admin()) with check (is_admin());

drop policy if exists roadmap_imports_self_select on roadmap_imports;
create policy roadmap_imports_self_select on roadmap_imports for select
  using (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Private storage bucket for the source documents. Admin-only access.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('roadmap-imports', 'roadmap-imports', false)
on conflict (id) do nothing;

drop policy if exists roadmap_imports_objects_admin on storage.objects;
create policy roadmap_imports_objects_admin on storage.objects for all
  using (bucket_id = 'roadmap-imports' and is_admin())
  with check (bucket_id = 'roadmap-imports' and is_admin());
