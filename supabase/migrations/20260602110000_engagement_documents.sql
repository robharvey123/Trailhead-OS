-- Engagement-scoped documents (weekly updates, etc.). Additive, OS RLS pattern.
create table if not exists engagement_documents (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements(id) on delete cascade,
  type text not null default 'weekly_update',
  title text,
  body_markdown text,
  week_start date,
  created_at timestamptz not null default now()
);
create index if not exists idx_engagement_documents_engagement on engagement_documents (engagement_id);

alter table engagement_documents enable row level security;
drop policy if exists engagement_documents_authenticated_full_access on engagement_documents;
create policy engagement_documents_authenticated_full_access on engagement_documents for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
