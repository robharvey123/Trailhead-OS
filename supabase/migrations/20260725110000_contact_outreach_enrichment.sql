-- Per-contact enrichment used by outreach merge tags ({{sub_trade}}, {{size_signal}})
-- and the call queue's opening-line context. The plan referenced these as template
-- vars / call-queue fields but never provisioned them; they belong on the contact.
alter table contacts
  add column if not exists sub_trade text,
  add column if not exists size_signal text;
