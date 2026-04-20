-- Fix RLS on tasks: revert owner-only policy back to authenticated access
-- The owner_user_id policy blocks tasks created via service role (cowork/AI)
-- which have NULL owner_user_id. Since this is single-tenant (Rob only),
-- authenticated access is sufficient.
-- NOTE: this migration was recorded as applied but partially failed.
-- Remaining fixes applied in 20260410100000_fix_rls_remaining.sql

drop policy if exists tasks_owner_access on tasks;
drop policy if exists tasks_authenticated_full_access on tasks;
create policy tasks_authenticated_full_access
  on tasks for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
