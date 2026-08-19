-- Marketing contact-form submissions now persist as enquiries, alongside the
-- discovery-form ones. Without a discriminator the two are indistinguishable
-- in the OS: a discovery enquiry carries team size, devices and offline
-- requirements and feeds the quote workflow, while a contact enquiry is a
-- name, a message and which door it arrived through.
--
-- `source` separates them. `track` and `workstream` record the sub-brand the
-- visitor came through (/consulting, /studio or /labs), so "which door
-- produces work" becomes a query instead of an inbox trawl.
--
-- Existing rows all came from the discovery form, so the default backfills
-- them correctly.

alter table enquiries
  add column if not exists source text not null default 'discovery',
  add column if not exists track text,
  add column if not exists workstream text;

create index if not exists idx_enquiries_source_created_at
  on enquiries(source, created_at desc);
