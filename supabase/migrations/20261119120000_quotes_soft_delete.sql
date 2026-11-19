-- Soft delete for quotes (matches invoices.deleted_at). Nothing is ever removed:
-- the Cowork/MCP delete_quote tool stamps deleted_at, and every reader filters
-- `deleted_at is null`. Restore by setting it back to null.
alter table quotes add column if not exists deleted_at timestamptz;
create index if not exists idx_quotes_deleted_at on quotes(deleted_at) where deleted_at is null;
