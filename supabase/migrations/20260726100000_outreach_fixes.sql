-- Brief 6 fixes.
-- 1) A render failure now stops a recipient with a terminal reason, so it needs
--    an 'error' value on the stopped_reason check.
-- 2) Unique (recipient_id, step_id) on sends is the database backstop against a
--    duplicated step delivery (the recipient-level claim is not exclusive from
--    step 2 onward). The send path inserts the send row before hitting Resend.
-- 3) Per-step template overrides keyed on contact.channel let one linear campaign
--    do sector-tailored first touches with generic follow-ups (one cap, one stats).

alter table outreach_recipients drop constraint if exists outreach_recipients_stopped_reason_check;
alter table outreach_recipients add constraint outreach_recipients_stopped_reason_check
  check (stopped_reason in ('replied','unsubscribed','bounced','complained','manual','converted','error'));

create unique index if not exists idx_outreach_sends_recipient_step on outreach_sends (recipient_id, step_id);

create table if not exists outreach_step_template_overrides (
  step_id uuid not null references outreach_campaign_steps(id) on delete cascade,
  channel text not null,
  template_id uuid not null references outreach_templates(id),
  primary key (step_id, channel)
);

alter table outreach_step_template_overrides enable row level security;
drop policy if exists outreach_step_template_overrides_employee_rw on outreach_step_template_overrides;
create policy outreach_step_template_overrides_employee_rw on outreach_step_template_overrides
  for all to authenticated using (is_employee()) with check (is_employee());
