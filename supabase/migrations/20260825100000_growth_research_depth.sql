-- Growth engine v2 — research depth, executable actions, paid media.
--
-- Phase A: honest keyword data (Labs KD + intent), GSC query×page history,
--          parsed SERP state.
-- Phase B: competitor keyword sets, seasonality.
-- Phase C: technical page issues.
-- Phase D: keyword → ranking URL cache, refresh worksheets.
-- Phase E: ads_* tables (Google + Meta) joined to seo_sites.
--
-- RLS: admin-only on every table via is_admin(), same as the rest of seo_*.

-- ── A1: real difficulty and real intent ──────────────────────────────────────
alter table seo_keywords
  add column if not exists keyword_difficulty int,
  add column if not exists ads_competition int,
  add column if not exists intent_confidence numeric,
  add column if not exists intent_source text,
  add column if not exists enriched_at timestamptz,
  add column if not exists cpc numeric;

-- The value that has lived in `difficulty` so far is the Google Ads competition
-- index (paid competition, 0-100). Move it out so `difficulty` only ever holds
-- organic KD from here on.
update seo_keywords set ads_competition = difficulty where difficulty is not null and ads_competition is null;
update seo_keywords set difficulty = null where keyword_difficulty is null;
update seo_keywords set intent_source = 'model' where intent is not null and intent_source is null;

-- Sources widen: labs suggestions/related, competitor gap, Google Ads search terms.
-- (No check constraint existed on source; document the vocabulary here.)
--   'gsc' | 'dataforseo' | 'manual' | 'labs_suggestion' | 'labs_related' | 'competitor_gap' | 'google_ads'

-- ── D1: ranking URL cache ────────────────────────────────────────────────────
alter table seo_keywords
  add column if not exists ranking_url text,
  add column if not exists ranking_url_checked_at timestamptz,
  add column if not exists ranking_url_clicks int,
  add column if not exists ranking_url_impressions int,
  add column if not exists ranking_url_position numeric;

-- ── E2.5: commercial weighting from paid data ────────────────────────────────
alter table seo_keywords
  add column if not exists commercial_value numeric,        -- Ads conversion value attributed to this query (window)
  add column if not exists conversions_per_1000_impressions numeric,
  add column if not exists value_per_click numeric,
  add column if not exists paid_checked_at timestamptz;

-- ── Site settings: backfill guard, clustering threshold, spend guard, crawl ──
alter table seo_sites
  add column if not exists last_gsc_backfill_at timestamptz,
  add column if not exists serp_overlap_threshold int not null default 3,
  add column if not exists monthly_api_budget numeric,           -- USD, DataForSEO
  add column if not exists api_spend_month text,                 -- YYYY-MM the counter refers to
  add column if not exists api_spend_mtd numeric not null default 0,
  add column if not exists max_crawl_pages int not null default 200,
  add column if not exists last_crawl_at timestamptz,
  add column if not exists crawl_task_id text,
  add column if not exists monthly_ads_budget numeric;           -- client media budget, for pacing

-- ── A2: GSC query × page history ─────────────────────────────────────────────
create table if not exists seo_gsc_query_page (
  site_id uuid not null references seo_sites(id) on delete cascade,
  date date not null,
  query text not null,
  page text not null,
  clicks int not null default 0,
  impressions int not null default 0,
  position numeric,
  primary key (site_id, date, query, page)
);
create index if not exists idx_gsc_qp_site_date on seo_gsc_query_page (site_id, date desc);
create index if not exists idx_gsc_qp_site_query on seo_gsc_query_page (site_id, query);
create index if not exists idx_gsc_qp_site_page on seo_gsc_query_page (site_id, page);

-- ── A3: parsed SERP state ────────────────────────────────────────────────────
create table if not exists seo_serp_state (
  id uuid primary key default gen_random_uuid(),
  keyword_id uuid not null references seo_keywords(id) on delete cascade,
  snapshot_id uuid references seo_serp_snapshots(id) on delete cascade,
  captured_at timestamptz not null,
  our_position int,
  our_url text,
  top_urls text[] not null default '{}',
  top_domains text[] not null default '{}',
  item_types text[] not null default '{}',
  ai_overview boolean not null default false,
  ai_overview_cites_us boolean not null default false,
  ai_overview_urls text[] not null default '{}',
  featured_snippet_domain text,
  paa_count int not null default 0,
  paa_questions text[] not null default '{}'
);
create index if not exists idx_seo_serp_state_kw on seo_serp_state (keyword_id, captured_at desc);
create unique index if not exists idx_seo_serp_state_snapshot on seo_serp_state (snapshot_id) where snapshot_id is not null;

-- ── B2: competitors and their keyword sets ───────────────────────────────────
create table if not exists seo_competitors (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references seo_sites(id) on delete cascade,
  domain text not null,
  added_by text not null default 'manual' check (added_by in ('manual', 'serp', 'labs')),
  tracked boolean not null default true,
  last_pulled_at timestamptz,
  keyword_count int,
  created_at timestamptz not null default now(),
  unique (site_id, domain)
);
create index if not exists idx_seo_competitors_site on seo_competitors (site_id);

create table if not exists seo_competitor_keywords (
  site_id uuid not null references seo_sites(id) on delete cascade,
  competitor_domain text not null,
  keyword text not null,
  position int,
  url text,
  search_volume int,
  keyword_difficulty int,
  cpc numeric,
  etv numeric,                       -- DataForSEO estimated traffic value
  pulled_at timestamptz not null default now(),
  primary key (site_id, competitor_domain, keyword)
);
create index if not exists idx_seo_competitor_keywords_site_kw on seo_competitor_keywords (site_id, keyword);

-- ── B3: seasonality ──────────────────────────────────────────────────────────
create table if not exists seo_keyword_volume_monthly (
  keyword_id uuid not null references seo_keywords(id) on delete cascade,
  year int not null,
  month int not null,
  search_volume int not null default 0,
  primary key (keyword_id, year, month)
);

-- ── C1: technical page issues ────────────────────────────────────────────────
create table if not exists seo_page_issues (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references seo_sites(id) on delete cascade,
  url text not null,
  issue_type text not null,
  severity text not null default 'medium' check (severity in ('critical', 'high', 'medium', 'low')),
  detail text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (site_id, url, issue_type)
);
create index if not exists idx_seo_page_issues_open on seo_page_issues (site_id, severity) where resolved_at is null;

create table if not exists seo_page_vitals (
  site_id uuid not null references seo_sites(id) on delete cascade,
  url text not null,
  measured_at timestamptz not null default now(),
  performance_score int,
  lcp_ms int,
  cls numeric,
  inp_ms int,
  tbt_ms int,
  primary key (site_id, url)
);

-- ── D2: refresh worksheets ───────────────────────────────────────────────────
create table if not exists seo_page_refreshes (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references seo_sites(id) on delete cascade,
  url text not null,
  generated_at timestamptz not null default now(),
  payload jsonb not null default '{}',
  checked jsonb not null default '{}',            -- { itemKey: true } — persisted checkboxes
  status text not null default 'open' check (status in ('open', 'applied', 'dismissed')),
  applied_at timestamptz,
  pr_url text,
  estimated_upside_clicks int,
  unique (site_id, url)
);
create index if not exists idx_seo_page_refreshes_site on seo_page_refreshes (site_id, status);

-- ── E1 / E3: paid media ──────────────────────────────────────────────────────
create table if not exists ads_accounts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references seo_sites(id) on delete cascade,
  platform text not null check (platform in ('google', 'meta')),
  external_id text not null,          -- customer id / ad account id
  name text,
  currency text,
  manager_id text,                    -- MCC / business manager
  status text not null default 'active',
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (platform, external_id)
);
create index if not exists idx_ads_accounts_site on ads_accounts (site_id);

create table if not exists ads_campaigns (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ads_accounts(id) on delete cascade,
  external_id text not null,
  name text not null,
  channel text,                       -- search / pmax / display / video / meta objective
  status text,
  daily_budget numeric,
  bidding_strategy text,
  unique (account_id, external_id)
);

create table if not exists ads_daily (
  account_id uuid not null references ads_accounts(id) on delete cascade,
  campaign_id uuid references ads_campaigns(id) on delete cascade,
  date date not null,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  cost numeric not null default 0,
  conversions numeric not null default 0,
  conversion_value numeric not null default 0,
  -- campaign_id is nullable for account-level rows; a composite PK cannot hold
  -- nulls, so use a generated non-null key column instead.
  campaign_key text generated always as (coalesce(campaign_id::text, 'account')) stored,
  primary key (account_id, campaign_key, date)
);
create index if not exists idx_ads_daily_account_date on ads_daily (account_id, date desc);

create table if not exists ads_keywords (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ads_accounts(id) on delete cascade,
  campaign_id uuid references ads_campaigns(id) on delete cascade,
  ad_group_external_id text,
  keyword text not null,
  match_type text,
  status text,
  quality_score int,
  qs_landing_page text,               -- ABOVE_AVERAGE / AVERAGE / BELOW_AVERAGE
  qs_ad_relevance text,
  qs_expected_ctr text,
  landing_page text,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  cost numeric not null default 0,
  conversions numeric not null default 0,
  conversion_value numeric not null default 0,
  average_cpc numeric,
  impression_share numeric,
  lost_is_budget numeric,
  lost_is_rank numeric,
  window_start date,
  window_end date,
  campaign_key text generated always as (coalesce(campaign_id::text, 'account')) stored,
  unique (account_id, campaign_key, keyword, match_type)
);
create index if not exists idx_ads_keywords_account on ads_keywords (account_id);

create table if not exists ads_search_terms (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ads_accounts(id) on delete cascade,
  search_term text not null,
  matched_keyword text,
  campaign_id uuid references ads_campaigns(id) on delete cascade,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  cost numeric not null default 0,
  conversions numeric not null default 0,
  conversion_value numeric not null default 0,
  window_start date,
  window_end date,
  campaign_key text generated always as (coalesce(campaign_id::text, 'account')) stored,
  unique (account_id, search_term, campaign_key)
);
create index if not exists idx_ads_search_terms_account on ads_search_terms (account_id);

create table if not exists ads_creatives (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ads_accounts(id) on delete cascade,
  external_id text not null,
  adset_external_id text,
  campaign_id uuid references ads_campaigns(id) on delete cascade,
  name text,
  format text,                        -- image / video / carousel
  primary_text text,
  headline text,
  destination_url text,
  thumbnail_url text,
  status text,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  frequency numeric,
  clicks bigint not null default 0,
  spend numeric not null default 0,
  conversions numeric not null default 0,
  conversion_value numeric not null default 0,
  ctr numeric,
  first_week_ctr numeric,             -- creative's own baseline for fatigue detection
  first_seen_at timestamptz not null default now(),
  window_start date,
  window_end date,
  unique (account_id, external_id)
);
create index if not exists idx_ads_creatives_account on ads_creatives (account_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'seo_gsc_query_page', 'seo_serp_state', 'seo_competitors', 'seo_competitor_keywords',
    'seo_keyword_volume_monthly', 'seo_page_issues', 'seo_page_vitals', 'seo_page_refreshes',
    'ads_accounts', 'ads_campaigns', 'ads_daily', 'ads_keywords', 'ads_search_terms', 'ads_creatives'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_admin_rw', t);
    execute format(
      'create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())',
      t || '_admin_rw', t
    );
  end loop;
end $$;

-- ── B1: clusters record how they were formed ─────────────────────────────────
alter table seo_clusters
  add column if not exists method text not null default 'model',   -- 'model' | 'serp_overlap'
  add column if not exists rationale text,
  add column if not exists evidence jsonb;
