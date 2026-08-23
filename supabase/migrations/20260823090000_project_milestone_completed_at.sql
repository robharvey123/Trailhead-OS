-- Cowork API write gaps (23 Aug 2026): the new milestone PATCH route stamps
-- when a milestone was completed. Existing completed=true rows keep a null
-- completed_at (we don't know when they flipped); only new flips are stamped.
alter table project_milestones add column if not exists completed_at timestamptz;
