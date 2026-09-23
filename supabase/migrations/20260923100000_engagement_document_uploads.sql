-- ============================================================================
-- Two-step document uploads for engagements.
--
-- Base64 through an MCP tool call costs ~30k tokens for an 88 KB PDF, so large
-- files now go: reserve a row + signed upload URL → client PUTs the bytes
-- straight to storage → confirm. A reserved row is 'pending' until confirmed and
-- is filtered out of every document list, so a half-finished upload is never
-- visible. `upload_state` defaults to 'live', which is what every existing row
-- (and every single-shot upload_engagement_document call) is.
-- ============================================================================

alter table engagement_documents
  add column if not exists upload_state text not null default 'live';

alter table engagement_documents
  drop constraint if exists engagement_documents_upload_state_check;

alter table engagement_documents
  add constraint engagement_documents_upload_state_check
  check (upload_state in ('pending', 'live'));

-- Lists filter on (engagement_id, upload_state); the engagement index alone left
-- the state test to a filter step on every read.
create index if not exists idx_engagement_documents_engagement_state
  on engagement_documents (engagement_id, upload_state);
