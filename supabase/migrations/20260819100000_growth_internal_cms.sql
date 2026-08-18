-- Growth: third publish target — 'internal' posts straight into this app's own
-- blog_posts table (the trailheadholdings.uk marketing blog) as an unpublished
-- draft. The GitHub adapter targets a SEPARATE repo (e.g. engineeros.uk's
-- codebase); it never touches the marketing blog, which is database-backed.
alter table seo_sites drop constraint if exists seo_sites_cms_type_check;
alter table seo_sites add constraint seo_sites_cms_type_check
  check (cms_type in ('none', 'github', 'wordpress', 'internal'));
