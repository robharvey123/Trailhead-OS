-- Growth module: a ledger of DataForSEO tasks we have posted.
--
-- The original design used DataForSEO's own tasks_ready endpoint as the pending
-- queue ("no tracking table needed"). That was wrong: tasks_ready is a
-- once-only list, so any collect run that failed — bad credentials, a deploy
-- blip, a DataForSEO 5xx — dropped those tasks off it permanently. This table
-- gives collection a memory, so a failed tick costs a retry rather than the work.

create table if not exists seo_dfs_tasks (
  id text primary key,                    -- DataForSEO task id
  kind text not null check (kind in ('serp', 'keyword_ideas')),
  tag text not null,                      -- serp:<keyword_id> | kw:<site_id>
  keyword text,                           -- for humans reading this table
  posted_at timestamptz not null default now(),
  collected_at timestamptz,
  attempts integer not null default 0,
  last_error text
);

-- The collect cron's working set: posted, not yet collected, oldest first.
create index if not exists idx_seo_dfs_tasks_pending
  on seo_dfs_tasks (posted_at) where collected_at is null;

alter table seo_dfs_tasks enable row level security;
drop policy if exists seo_dfs_tasks_admin_rw on seo_dfs_tasks;
create policy seo_dfs_tasks_admin_rw on seo_dfs_tasks for all to authenticated
  using (is_admin()) with check (is_admin());
