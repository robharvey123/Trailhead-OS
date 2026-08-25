-- ON CONFLICT (snapshot_id) cannot infer a partial unique index; a plain
-- unique constraint allows multiple NULLs anyway, so drop the predicate.
drop index if exists idx_seo_serp_state_snapshot;
alter table seo_serp_state drop constraint if exists seo_serp_state_snapshot_id_key;
alter table seo_serp_state add constraint seo_serp_state_snapshot_id_key unique (snapshot_id);
