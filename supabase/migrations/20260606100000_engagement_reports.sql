-- ============================================================================
-- Brief 20 — engagement reports (internal weekly + client-facing weekly/monthly).
-- Stage 1 lands the table + storage; the generation pipeline (PDF/XLSX/LLM/send)
-- fills the content columns in later stages.
-- Idempotent / re-runnable.
-- ============================================================================

do $$ begin
  create type report_kind as enum ('weekly_internal', 'weekly_client', 'monthly_client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_status as enum ('draft', 'sent', 'archived');
exception when duplicate_object then null; end $$;

create table if not exists engagement_reports (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements(id) on delete cascade,
  kind report_kind not null,
  period_start date not null,
  period_end date not null,
  status report_status not null default 'draft',

  -- Generated content
  narrative_json jsonb,        -- LLM output
  narrative_edited jsonb,      -- user-edited; the sent version uses this when present
  pdf_storage_path text,
  xlsx_storage_path text,

  -- Numbers (snapshot at generation; PDF + XLSX render from the same ReportData)
  total_hours numeric(8, 2),
  billable_hours numeric(8, 2),
  total_value_gbp numeric(12, 2),
  task_count_completed int,

  -- Recipients + send audit
  recipient_emails text[] not null default '{}',
  sent_at timestamptz,
  sent_to_message_id text,     -- Gmail message id of the sent email
  sent_by uuid references auth.users(id) on delete set null,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (engagement_id, kind, period_start) -- one per period + kind
);

create index if not exists idx_engagement_reports_eng on engagement_reports (engagement_id, period_start desc);

drop trigger if exists engagement_reports_updated_at on engagement_reports;
create trigger engagement_reports_updated_at
  before update on engagement_reports
  for each row execute function update_workspace_updated_at();

alter table engagement_reports enable row level security;

-- Internal + client-facing reports are admin-only in v1.
drop policy if exists engagement_reports_admin on engagement_reports;
create policy engagement_reports_admin on engagement_reports for all
  using (is_admin()) with check (is_admin());

-- Private storage bucket for the rendered PDF + XLSX.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'engagement-reports', 'engagement-reports', false, 52428800,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do nothing;

drop policy if exists er_read on storage.objects;
create policy er_read on storage.objects for select
  using (bucket_id = 'engagement-reports' and is_admin());
drop policy if exists er_write on storage.objects;
create policy er_write on storage.objects for insert
  with check (bucket_id = 'engagement-reports' and is_admin());
drop policy if exists er_delete on storage.objects;
create policy er_delete on storage.objects for delete
  using (bucket_id = 'engagement-reports' and is_admin());
