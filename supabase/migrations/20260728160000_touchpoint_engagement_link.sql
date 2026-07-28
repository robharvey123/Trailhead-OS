-- Link touchpoints (calls/emails/meetings/notes) to engagements. on delete set
-- null so deleting an engagement never destroys interaction history (matches how
-- projects / time_entries behave in deleteEngagement).

alter table touchpoints
  add column if not exists engagement_id uuid references engagements(id) on delete set null;

create index if not exists idx_touchpoints_engagement_id on touchpoints(engagement_id);

-- Relax "must have account or contact" so an engagement-only touchpoint is valid.
alter table touchpoints drop constraint if exists touchpoints_account_or_contact;
alter table touchpoints add constraint touchpoints_has_target
  check (account_id is not null or contact_id is not null or engagement_id is not null);
