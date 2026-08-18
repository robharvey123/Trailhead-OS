-- Growth engine (THH-SEO-001 v2, Phase 1) — keyword research, content pipeline,
-- AI visibility and link-building data for engineeros.uk and client sites.
--
-- Deliberately thin where the OS already has a home for something: link prospects'
-- companies/contacts/emails live in the CRM (accounts/contacts + Gmail logs);
-- campaigns live in projects; manual work lands in engagement_tasks. These tables
-- hold only the SEO-specific state. FKs reference `accounts` (the canonical CRM
-- table), not the retired crm_accounts.
--
-- RLS: admin-only on every table (matches scheduled_emails) — the Growth module
-- is an internal control surface, not contributor-facing.

-- ── Sites ────────────────────────────────────────────────────────────────────
create table if not exists seo_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null unique,
  workstream_id uuid references workstreams(id) on delete set null,
  -- Required (enforced in the app layer) when is_client — client SEO work must
  -- roll up to the same account as their invoices.
  client_account_id uuid references accounts(id) on delete set null,
  cms_type text not null default 'none' check (cms_type in ('none', 'github', 'wordpress')),
  cms_config jsonb not null default '{}',
  brand_voice text,
  icp text,
  gsc_property text,
  is_client boolean not null default false,
  last_gsc_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists seo_sites_updated_at on seo_sites;
create trigger seo_sites_updated_at
  before update on seo_sites
  for each row execute function update_workspace_updated_at();

-- ── Clusters (before keywords: keywords FK into clusters) ────────────────────
create table if not exists seo_clusters (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references seo_sites(id) on delete cascade,
  name text not null,
  pillar_keyword text,
  intent text,
  priority int not null default 0,
  target_url text,
  -- Set when the cluster is approved and becomes a content programme (Phase 3).
  project_id uuid references projects(id) on delete set null,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'archived')),
  created_at timestamptz not null default now()
);
create index if not exists idx_seo_clusters_site on seo_clusters (site_id, priority desc);

-- ── Keywords ─────────────────────────────────────────────────────────────────
-- Volume/difficulty come from DataForSEO or GSC only — never model-generated.
create table if not exists seo_keywords (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references seo_sites(id) on delete cascade,
  keyword text not null,
  search_volume int,
  difficulty int,
  intent text,
  source text not null default 'manual', -- 'gsc' | 'dataforseo' | 'manual'
  gsc_impressions int,
  gsc_clicks int,
  gsc_position numeric,
  cluster_id uuid references seo_clusters(id) on delete set null,
  status text not null default 'new',
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (site_id, keyword)
);
create index if not exists idx_seo_keywords_site on seo_keywords (site_id);
create index if not exists idx_seo_keywords_cluster on seo_keywords (cluster_id);

-- ── SERP snapshots ───────────────────────────────────────────────────────────
create table if not exists seo_serp_snapshots (
  id uuid primary key default gen_random_uuid(),
  keyword_id uuid not null references seo_keywords(id) on delete cascade,
  captured_at timestamptz not null default now(),
  results jsonb not null
);
create index if not exists idx_seo_serp_snapshots_keyword
  on seo_serp_snapshots (keyword_id, captured_at desc);

-- ── Briefs ───────────────────────────────────────────────────────────────────
create table if not exists seo_briefs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references seo_sites(id) on delete cascade,
  cluster_id uuid references seo_clusters(id) on delete set null,
  title text not null,
  slug text,
  target_keyword text,
  secondary_keywords text[] not null default '{}',
  intent text,
  outline jsonb,
  word_target int,
  internal_links jsonb,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'drafted')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists idx_seo_briefs_site on seo_briefs (site_id, status);

-- ── Articles ─────────────────────────────────────────────────────────────────
create table if not exists seo_articles (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references seo_sites(id) on delete cascade,
  brief_id uuid references seo_briefs(id) on delete set null,
  title text not null,
  slug text,
  body_mdx text,
  meta_description text,
  schema_jsonld jsonb,
  status text not null default 'drafting' check (status in ('drafting', 'review', 'approved', 'published', 'archived')),
  published_url text,
  published_at timestamptz,
  word_count int,
  model_used text,
  token_cost numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_seo_articles_site on seo_articles (site_id, status);
create index if not exists idx_seo_articles_brief on seo_articles (brief_id);

drop trigger if exists seo_articles_updated_at on seo_articles;
create trigger seo_articles_updated_at
  before update on seo_articles
  for each row execute function update_workspace_updated_at();

-- ── AI visibility (Phase 6, tables now so the model is complete) ─────────────
create table if not exists seo_prompts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references seo_sites(id) on delete cascade,
  prompt text not null,
  category text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_seo_prompts_site on seo_prompts (site_id) where active;

create table if not exists seo_ai_mentions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references seo_sites(id) on delete cascade,
  prompt_id uuid not null references seo_prompts(id) on delete cascade,
  provider text not null,
  run_at timestamptz not null default now(),
  brand_mentioned boolean not null default false,
  position int,
  competitors_mentioned text[] not null default '{}',
  raw_response text
);
create index if not exists idx_seo_ai_mentions_site on seo_ai_mentions (site_id, run_at desc);
create index if not exists idx_seo_ai_mentions_prompt on seo_ai_mentions (prompt_id);

-- ── Link targets (Phase 5) ───────────────────────────────────────────────────
-- Thin by design: company/contact/email history live in the CRM. task_id points
-- at engagement_tasks — the canonical task system the /tasks views render.
create table if not exists seo_link_targets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references seo_sites(id) on delete cascade,
  crm_account_id uuid references accounts(id) on delete set null,
  url text not null,
  domain_authority int,
  angle text,
  tier int,
  status text not null default 'identified' check (status in ('identified', 'researching', 'outreach', 'won', 'lost')),
  task_id uuid references engagement_tasks(id) on delete set null,
  won_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_seo_link_targets_site on seo_link_targets (site_id, status);
create index if not exists idx_seo_link_targets_account on seo_link_targets (crm_account_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table seo_sites enable row level security;
alter table seo_clusters enable row level security;
alter table seo_keywords enable row level security;
alter table seo_serp_snapshots enable row level security;
alter table seo_briefs enable row level security;
alter table seo_articles enable row level security;
alter table seo_prompts enable row level security;
alter table seo_ai_mentions enable row level security;
alter table seo_link_targets enable row level security;

drop policy if exists seo_sites_admin_rw on seo_sites;
create policy seo_sites_admin_rw on seo_sites for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists seo_clusters_admin_rw on seo_clusters;
create policy seo_clusters_admin_rw on seo_clusters for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists seo_keywords_admin_rw on seo_keywords;
create policy seo_keywords_admin_rw on seo_keywords for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists seo_serp_snapshots_admin_rw on seo_serp_snapshots;
create policy seo_serp_snapshots_admin_rw on seo_serp_snapshots for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists seo_briefs_admin_rw on seo_briefs;
create policy seo_briefs_admin_rw on seo_briefs for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists seo_articles_admin_rw on seo_articles;
create policy seo_articles_admin_rw on seo_articles for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists seo_prompts_admin_rw on seo_prompts;
create policy seo_prompts_admin_rw on seo_prompts for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists seo_ai_mentions_admin_rw on seo_ai_mentions;
create policy seo_ai_mentions_admin_rw on seo_ai_mentions for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists seo_link_targets_admin_rw on seo_link_targets;
create policy seo_link_targets_admin_rw on seo_link_targets for all to authenticated
  using (is_admin()) with check (is_admin());
