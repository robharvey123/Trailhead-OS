-- ============================================================================
-- A 'publishing' state between approved and published.
--
-- 'published' used to be set the moment a PR opened, so an article counted as
-- live while its PR was unmerged, its preview build failing, or its URL 404ing.
-- PR #10 on brookweald-site merged in the same second Vercel reported failure
-- and broke main, and the article still read as published.
--
-- Now: approved → publishing (PR open) → published (merged AND the URL answers
-- 200). Only the GitHub path uses it — a WordPress or internal-blog publish
-- creates a draft that is deliberately not live, so there is no URL to poll.
-- ============================================================================

alter table seo_articles drop constraint if exists seo_articles_status_check;
alter table seo_articles add constraint seo_articles_status_check
  check (status in ('drafting', 'review', 'approved', 'publishing', 'published', 'archived'));

-- When the article entered 'publishing', so the verifier can give up on one
-- that never goes live instead of polling it forever.
alter table seo_articles
  add column if not exists publishing_since timestamptz;

-- The verify cron scans for status='publishing' every few minutes.
create index if not exists idx_seo_articles_publishing
  on seo_articles (status) where status = 'publishing';
