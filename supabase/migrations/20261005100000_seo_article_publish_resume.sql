-- ============================================================================
-- Resumable publishing for Growth articles.
--
-- publishViaGithubPr creates a branch, commits a file and opens a PR. A failure
-- at step 2 or 3 left nothing recorded, so the next click cut a NEW branch and
-- opened a SECOND PR, orphaning the first. These columns let a retry land on
-- the same branch and file, which is what makes the operation idempotent.
--
-- No unique index on (site_id, slug): real data already violates it (Brookweald
-- has two articles on 'cheap-community-hall-hire-near-me', one published, one
-- approved, from the double brief-approval path). The collision is refused in
-- code with a message naming the other article instead.
-- ============================================================================

alter table seo_articles
  add column if not exists publish_branch text,  -- the branch a publish attempt owns
  add column if not exists publish_path text,    -- the content file that attempt writes
  add column if not exists publish_error text;   -- last publish failure, cleared on success

-- Resolving a slug collision scans by (site_id, slug) on every publish.
create index if not exists idx_seo_articles_site_slug
  on seo_articles (site_id, slug);
