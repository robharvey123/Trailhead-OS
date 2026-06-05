-- ============================================================================
-- Brief 18 — remove the ENGAGEMENT-level "workstreams" concept.
--
-- IMPORTANT: this does NOT touch the core `workstreams` table (slug/label/colour,
-- 6 rows) — that is the OS backbone (projects/tasks/kanban/dashboard all FK to
-- it). The brief conflated the two; only the engagement-level free-text labels
-- are removed here:
--   * engagements.workstreams  text[]            (3 rows had data)
--   * time_entries.workstream  text + its index  (10 rows had a label)
--   * engagement_workstream_split  VIEW          (derived from time_entries.workstream)
--
-- Data is archived first (cheap insurance), then dropped. The view depends on
-- time_entries.workstream, so it's dropped before the column.
-- ============================================================================

-- 1. Archive (one-off snapshots; kept until manually dropped).
create table if not exists _archive_engagements_workstreams_2026_06 as
  select id, workstreams from engagements where workstreams is not null and array_length(workstreams, 1) > 0;

create table if not exists _archive_time_entries_workstream_2026_06 as
  select id, workstream from time_entries where workstream is not null;

-- Archives hold the same data the live columns did — keep them off the API roles.
revoke all on _archive_engagements_workstreams_2026_06 from authenticated, anon;
revoke all on _archive_time_entries_workstream_2026_06 from authenticated, anon;

-- 2. Drop the dependent view first, then the columns it referenced.
drop view if exists engagement_workstream_split;

alter table time_entries drop column if exists workstream; -- auto-drops idx_time_entries_workstream
alter table engagements drop column if exists workstreams;
