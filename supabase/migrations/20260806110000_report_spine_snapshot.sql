-- Stage C — store the factual spine on the report row.
--
-- The spine is reconstructed from engagement_task_activity (immutable history), so
-- storing it means regenerating October's report in January returns identical
-- content. The PDF renders the task lists from this snapshot; the AI writes prose
-- around it and cannot change what is reported.
alter table engagement_reports add column if not exists spine_json jsonb;
