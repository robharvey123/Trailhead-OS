-- Stage B amendment — internal rows must never render in a client report.
--
-- Stage A stripped internal fields; nothing stripped internal ROWS. An
-- engagement task like "Add yourself as a contributor at £175/hr" is legitimate
-- but must never reach a client document. Fail-closed: a nullable boolean that
-- the period spine honours only when explicitly TRUE. Null/false = internal.
-- Defaulting to visible with an internal flag would leak the first time anyone
-- forgets; this cannot.
--
-- Nullable, no default, no backfill — a one-time bulk update sets the visible
-- ones after an eyeball.

alter table engagement_tasks add column if not exists client_visible boolean;
