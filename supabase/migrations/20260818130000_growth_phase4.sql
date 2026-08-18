-- Growth Phase 4 (publishing) — publish_ref records where the article went:
-- the GitHub pull-request URL for repo-backed sites, the WordPress post id for
-- client sites. published_url is the eventual live URL.
alter table seo_articles add column if not exists publish_ref text;
