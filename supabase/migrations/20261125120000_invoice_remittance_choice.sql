-- ============================================================================
-- Per-invoice choice of remittance account.
--
-- remittance_accounts.print_by_default: true (the existing behaviour) means
-- the account prints on every invoice in its currency unless the invoice picks
-- a specific account. false means the account is an alternative: it prints
-- only on invoices that choose it. This lets a second GBP account (e.g.
-- Revolut) sit alongside the original UK account without replacing it.
--
-- invoices.remittance_account_id: the account chosen for this invoice. NULL
-- means "default" (every active print_by_default account for the currency,
-- else the legacy payment block). When set, only that account prints.
--
-- No account data is seeded; Rob enters values through Settings.
-- ============================================================================

alter table remittance_accounts
  add column if not exists print_by_default boolean not null default true;

comment on column remittance_accounts.print_by_default is
  'true: prints on every invoice in this currency that has not chosen a specific account. false: prints only on invoices that choose it (invoices.remittance_account_id).';

alter table invoices
  add column if not exists remittance_account_id uuid
    references remittance_accounts(id) on delete set null;

comment on column invoices.remittance_account_id is
  'Remittance account chosen for this invoice. NULL = currency default (print_by_default accounts, else the legacy payment block). When set, only this account prints.';
