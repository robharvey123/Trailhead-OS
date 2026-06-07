-- ============================================================================
-- FreeAgent sync — Phase 2 (contact mapping) + Phase 3 (invoice link).
--
-- accounts.freeagent_contact_url : the FreeAgent contact URL for a client,
--   created on demand and cached so we never duplicate contacts.
-- invoices.freeagent_invoice_url : the pushed FreeAgent invoice URL; its presence
--   is the idempotency guard against double-pushing. + a synced_at timestamp.
-- FreeAgent references both by full URL, not numeric id.
-- ============================================================================

alter table public.accounts
  add column if not exists freeagent_contact_url text;

alter table public.invoices
  add column if not exists freeagent_invoice_url text,
  add column if not exists freeagent_synced_at timestamptz;
