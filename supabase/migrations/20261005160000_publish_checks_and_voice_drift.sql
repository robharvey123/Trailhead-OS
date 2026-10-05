-- ============================================================================
-- Two fixes to the publish gate.
--
-- 1. brand_voice drift. An article drafted before the site's voice changed is
--    written in the old voice, and nothing said so at publish time. Stamping
--    when the voice last changed and when each article was last drafted lets
--    the publish button warn. Both default null, which reads as "unknown" and
--    warns about nothing — no false alarms on existing rows.
--
-- 2. drafted_at is backfilled from the best signal we already have so existing
--    articles are not all treated as unknown.
-- ============================================================================

alter table seo_sites
  add column if not exists brand_voice_updated_at timestamptz;

alter table seo_articles
  add column if not exists drafted_at timestamptz;

update seo_articles
set drafted_at = coalesce(draft_started_at, created_at)
where drafted_at is null;
