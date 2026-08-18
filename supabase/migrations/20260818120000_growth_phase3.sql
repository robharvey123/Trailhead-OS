-- Growth Phase 3 (clusters, briefs, drafts) — drafting runs as a cron-driven
-- status machine on seo_articles (like scheduled_emails), not a long request:
--   draft_started_at  claim marker; stale claims (>20 min) are retried
--   error             last failure; a failed article is NOT retried until the
--                     error is cleared (retry action in the UI), so a broken
--                     draft can't burn tokens in a loop
alter table seo_articles add column if not exists draft_started_at timestamptz;
alter table seo_articles add column if not exists error text;

create index if not exists idx_seo_articles_draft_queue
  on seo_articles (created_at)
  where status = 'drafting' and body_mdx is null;
