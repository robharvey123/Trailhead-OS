-- ============================================================================
-- Per-invoice choice of remittance account.
--
-- 1. remittance_accounts.print_by_default: when an invoice has no explicit
--    choice, only accounts flagged here print for its currency (existing rows
--    default to true, so current invoices render exactly as before). An
--    account with print_by_default = false is "pick only": it prints solely on
--    invoices that select it, e.g. a second GBP account.
-- 2. invoices.remittance_account_id: the account chosen on the invoice. Null
--    means the default (print_by_default accounts, or the legacy company
--    settings bank block when there are none). If the account is deleted the
--    invoice falls back to the default.
--
-- No account data lives in this migration.
-- ============================================================================

alter table remittance_accounts
  add column if not exists print_by_default boolean not null default true;

comment on column remittance_accounts.print_by_default is
  'Prints on invoices in this currency that have no explicit remittance_account_id. False = only prints when an invoice selects it.';

alter table invoices
  add column if not exists remittance_account_id uuid
    references remittance_accounts(id) on delete set null;

comment on column invoices.remittance_account_id is
  'Bank account chosen for this invoice. Null = default for the invoice currency.';
