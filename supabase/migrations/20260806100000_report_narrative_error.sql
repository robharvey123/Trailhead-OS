-- Surface a swallowed narrative failure instead of shipping a blank PDF.
-- generate.ts previously caught an LLM error with a bare `catch {}` and fell
-- through to EMPTY_NARRATIVE — producing a cover + hours table and nothing else.
-- Persist the failure so the review screen can show it. Nullable, cleared on a
-- successful regeneration.
alter table engagement_reports add column if not exists narrative_error text;
