-- FreeAgent sync: cache a FreeAgent contact URL on individual contacts too, for
-- invoices linked to a contact (no account). Mirrors accounts.freeagent_contact_url.
alter table public.contacts
  add column if not exists freeagent_contact_url text;
