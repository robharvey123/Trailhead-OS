-- Growth clusters no longer create Projects (a content programme is not a
-- Project). Nothing reads or writes seo_clusters.project_id any more, so the
-- column goes. Code deployed first; dropping the column afterwards is safe
-- because nothing selects it by name.
alter table public.seo_clusters drop column if exists project_id;
