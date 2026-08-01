-- Stage A (engagement reporting) — client-safe descriptions.
--
-- time_entries.description and engagement_tasks.description are written for
-- internal execution and must never reach a client artefact raw. Add a nullable
-- client-facing description on each; the report projection uses it, falling back
-- to a generic line (never the internal text) unless a repo flag opts in.
--
-- Both columns are NULLABLE with no default and no backfill, per the standing
-- column/FK rule.

alter table time_entries add column if not exists client_description text;
alter table engagement_tasks add column if not exists client_description text;
