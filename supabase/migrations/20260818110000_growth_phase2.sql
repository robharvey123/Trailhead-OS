-- Growth Phase 2 (Site Command Centre) — the two stores the dashboard reads
-- instead of computing on render:
--
--   seo_gsc_daily      site-level daily clicks/impressions/position from GSC
--                      (dimension: date), powering the 28-day stat cards,
--                      deltas and sparklines.
--   seo_growth_scores  one Growth Score row per site per day, computed by the
--                      nightly growth-score cron with its full component
--                      breakdown stored, so the score has history and is
--                      explainable after the fact.
--
-- Referring domains come from a nightly DataForSEO backlinks summary and are
-- cached on the site row — a live count per render would be paid API spam.

create table if not exists seo_gsc_daily (
  site_id uuid not null references seo_sites(id) on delete cascade,
  date date not null,
  clicks int not null default 0,
  impressions int not null default 0,
  position numeric,
  primary key (site_id, date)
);

create table if not exists seo_growth_scores (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references seo_sites(id) on delete cascade,
  score_date date not null,
  score int not null,
  breakdown jsonb not null,
  created_at timestamptz not null default now(),
  unique (site_id, score_date)
);
create index if not exists idx_seo_growth_scores_site
  on seo_growth_scores (site_id, score_date desc);

alter table seo_sites add column if not exists referring_domains int;
alter table seo_sites add column if not exists referring_domains_checked_at timestamptz;

alter table seo_gsc_daily enable row level security;
alter table seo_growth_scores enable row level security;

drop policy if exists seo_gsc_daily_admin_rw on seo_gsc_daily;
create policy seo_gsc_daily_admin_rw on seo_gsc_daily for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists seo_growth_scores_admin_rw on seo_growth_scores;
create policy seo_growth_scores_admin_rw on seo_growth_scores for all to authenticated
  using (is_admin()) with check (is_admin());
