-- Growth Phase 6 — the monthly report needs to know WHEN a link was won, not
-- just that it was.
alter table seo_link_targets add column if not exists won_at timestamptz;
