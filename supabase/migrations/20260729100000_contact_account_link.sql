-- CRM: index the contact→account link and add a normalised-name function for
-- fuzzy account matching (used by the contact form's live duplicate warning, the
-- linking backlog, and the import). Do NOT drop contacts.company — for the 105
-- unlinked contacts it is the only company record they have.

create index if not exists idx_contacts_account_id on contacts(account_id);

-- Normalised company name: lowercase, strip common legal/suffix words at word
-- boundaries, then strip everything non-alphanumeric. IMMUTABLE so it can back an
-- index. The TS mirror in lib/crm/normalise.ts MUST stay byte-identical.
create or replace function crm_normalise_name(input text) returns text
  language sql immutable as $$
    select regexp_replace(
      regexp_replace(lower(coalesce(input,'')),
        '\y(ltd|limited|llp|plc|inc|incorporated|srl|aps|ab|gmbh|bv|co|company|group|holdings|uk)\y', '', 'g'),
      '[^a-z0-9]', '', 'g')
  $$;

create index if not exists idx_accounts_norm_name on accounts (crm_normalise_name(name));
