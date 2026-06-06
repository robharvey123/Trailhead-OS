-- ============================================================================
-- Brief 19, Pass A — make projects.workstream_id nullable.
--
-- Pass A removes the workstream picker from the project form, so new projects are
-- created without a workstream. The column + data stay (Pass B archives & drops
-- them after a cooldown); this only relaxes the NOT NULL so inserts succeed.
-- Fully reversible: `alter table projects alter column workstream_id set not null;`
-- (board_columns.workstream_id stays NOT NULL — no new board_columns are created
--  now that the workstream kanban is retired; the table is dropped in Pass B.)
-- ============================================================================

alter table projects alter column workstream_id drop not null;
