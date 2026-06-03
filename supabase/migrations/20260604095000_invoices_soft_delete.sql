-- ============================================================================
-- Invoice soft-delete. Additive: a deleted_at timestamp; non-null = deleted.
-- Invoices are referenced by payments/ledgers/stripe, so we never hard-delete.
-- Admin-only enforcement of the soft-delete lives in the server action
-- (requireAdmin) — RLS stays is_employee full-access (brief 3) so employees can
-- still edit invoices; a column-scoped "only admins may set deleted_at" rule
-- would need a trigger, which is out of scope here.
-- ============================================================================

alter table invoices add column if not exists deleted_at timestamptz;

create index if not exists invoices_active_idx on invoices (created_at desc) where deleted_at is null;
