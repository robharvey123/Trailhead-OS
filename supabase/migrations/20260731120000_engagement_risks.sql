-- Stage B (engagement reporting) — a real risks/issues store.
--
-- Risks were previously free text authored by the model in the report narrative,
-- with no backing store. This table gives the period spine a factual source.
-- status is a DB-enforced lowercase enum. RLS mirrors engagement_tasks: admin, or
-- an active contributor on the engagement (is_on_engagement). engagement_id is
-- nullable per the standing rule; a null-engagement risk is admin-only.

do $$ begin
  create type engagement_risk_status as enum ('open', 'mitigating', 'closed');
exception when duplicate_object then null; end $$;

create table if not exists engagement_risks (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references engagements(id) on delete cascade,
  title text not null,
  detail text,
  status engagement_risk_status not null default 'open',
  raised_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_engagement_risks_engagement on engagement_risks (engagement_id, raised_at desc);

drop trigger if exists engagement_risks_updated_at on engagement_risks;
create trigger engagement_risks_updated_at
  before update on engagement_risks
  for each row execute function update_workspace_updated_at();

alter table engagement_risks enable row level security;

drop policy if exists engagement_risks_select on engagement_risks;
create policy engagement_risks_select on engagement_risks for select using (
  is_admin() or is_on_engagement(engagement_id)
);
drop policy if exists engagement_risks_insert on engagement_risks;
create policy engagement_risks_insert on engagement_risks for insert with check (
  is_admin() or is_on_engagement(engagement_id)
);
drop policy if exists engagement_risks_update on engagement_risks;
create policy engagement_risks_update on engagement_risks for update using (
  is_admin() or is_on_engagement(engagement_id)
) with check (
  is_admin() or is_on_engagement(engagement_id)
);
drop policy if exists engagement_risks_delete on engagement_risks;
create policy engagement_risks_delete on engagement_risks for delete using (
  is_admin() or is_on_engagement(engagement_id)
);
