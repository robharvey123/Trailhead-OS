-- ============================================================================
-- Outreach engine — reusable linear campaign engine. A campaign is an audience
-- (a static snapshot of contacts), a set of templates, and an ordered list of
-- steps; per-recipient state advances through the steps, plus a global email
-- suppression list. Single-tenant: no workspace/org columns anywhere.
-- Employee-level RLS throughout (the follow-up caller is an employee).
-- ============================================================================

-- --- Contact columns: outreach salutation + call/email compliance ------------
alter table contacts
  add column if not exists email_greeting text,
  add column if not exists do_not_email boolean not null default false,
  add column if not exists do_not_call boolean not null default false,
  add column if not exists ctps_registered boolean,
  add column if not exists ctps_checked_at timestamptz;
-- contacts already has contacts_employee_rw from the RLS lockdown — adding
-- columns does not change that, so no new policy here.

-- --- Audiences ---------------------------------------------------------------
create table if not exists outreach_audiences (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists outreach_audience_members (
  audience_id uuid not null references outreach_audiences(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (audience_id, contact_id)
);

-- --- Templates ---------------------------------------------------------------
create table if not exists outreach_templates (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  subject text not null default '',
  body_html text not null default '',
  body_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- Campaigns + steps -------------------------------------------------------
create table if not exists outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_id uuid references projects(id) on delete set null,
  audience_id uuid references outreach_audiences(id),
  status text not null default 'draft'
    check (status in ('draft','scheduled','running','paused','completed','cancelled')),
  from_name text,
  from_email text,
  reply_to text,
  daily_send_cap int not null default 20,
  send_window_start time not null default '07:30',
  send_window_end time not null default '16:00',
  send_days int[] not null default '{2,3,4}',   -- ISO weekdays: Tue–Thu
  timezone text not null default 'Europe/London',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists outreach_campaign_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references outreach_campaigns(id) on delete cascade,
  step_number int not null,
  template_id uuid references outreach_templates(id),
  delay_days int not null default 0,
  unique (campaign_id, step_number)
);

-- --- Per-recipient state -----------------------------------------------------
create table if not exists outreach_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references outreach_campaigns(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','active','completed','stopped')),
  current_step int not null default 0,
  next_send_at timestamptz,
  stopped_reason text
    check (stopped_reason in ('replied','unsubscribed','bounced','complained','manual','converted')),
  stopped_at timestamptz,
  -- Call-queue tracking (first-class; the activities row remains the audit log).
  call_status text,
  call_last_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  unique (campaign_id, contact_id)
);

-- --- Individual sends --------------------------------------------------------
create table if not exists outreach_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references outreach_campaigns(id) on delete cascade,
  recipient_id uuid not null references outreach_recipients(id) on delete cascade,
  step_id uuid references outreach_campaign_steps(id) on delete set null,
  resend_email_id text,
  subject text,
  status text not null default 'queued'
    check (status in ('queued','sent','delivered','opened','clicked','bounced','complained','failed')),
  sent_at timestamptz,
  delivered_at timestamptz,
  first_opened_at timestamptz,
  first_clicked_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

-- Raw webhook landing table (never updated). Only send_id links back; no FK to
-- recipients — this grows fast and one link is enough.
create table if not exists outreach_events (
  id uuid primary key default gen_random_uuid(),
  send_id uuid references outreach_sends(id) on delete cascade,
  resend_email_id text,
  type text,
  payload jsonb,
  occurred_at timestamptz,
  created_at timestamptz not null default now()
);

-- --- Global suppression list -------------------------------------------------
create table if not exists email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason text check (reason in ('unsubscribed','bounced','complained','manual')),
  source text,
  notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_email_suppressions_email on email_suppressions (lower(email));

-- --- Indexes that matter -----------------------------------------------------
create index if not exists idx_outreach_recipients_due on outreach_recipients (campaign_id, status, next_send_at);
create index if not exists idx_outreach_sends_resend on outreach_sends (resend_email_id);
create index if not exists idx_outreach_events_resend on outreach_events (resend_email_id);
create index if not exists idx_outreach_audience_members_contact on outreach_audience_members (contact_id);

-- --- updated_at triggers (shared helper) -------------------------------------
drop trigger if exists outreach_templates_updated_at on outreach_templates;
create trigger outreach_templates_updated_at before update on outreach_templates
  for each row execute function update_workspace_updated_at();

drop trigger if exists outreach_campaigns_updated_at on outreach_campaigns;
create trigger outreach_campaigns_updated_at before update on outreach_campaigns
  for each row execute function update_workspace_updated_at();

-- --- Campaign stats view (so the UI never aggregates client-side) ------------
-- security_invoker so the querying user's RLS on the base tables applies.
create or replace view outreach_campaign_stats
  with (security_invoker = true) as
select
  c.id as campaign_id,
  (select count(*) from outreach_audience_members m where m.audience_id = c.audience_id) as audience_size,
  count(distinct r.id) as recipients,
  count(distinct r.id) filter (where r.status = 'stopped') as stopped,
  count(distinct r.id) filter (where r.stopped_reason = 'replied') as replied,
  count(distinct s.id) filter (where s.status in ('sent','delivered','opened','clicked')) as sent,
  count(distinct s.id) filter (where s.status in ('delivered','opened','clicked')) as delivered,
  count(distinct s.id) filter (where s.first_opened_at is not null) as opened
from outreach_campaigns c
left join outreach_recipients r on r.campaign_id = c.id
left join outreach_sends s on s.campaign_id = c.id
group by c.id;

-- --- RLS: employee_rw on every outreach_* table + email_suppressions ---------
-- Matches 20260604090100_rls_lockdown.sql. is_employee() = owner/admin/employee.
do $$
declare t text;
begin
  foreach t in array array[
    'outreach_audiences','outreach_audience_members','outreach_templates',
    'outreach_campaigns','outreach_campaign_steps','outreach_recipients',
    'outreach_sends','outreach_events','email_suppressions'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_employee_rw', t);
    execute format(
      'create policy %I on %I for all to authenticated using (is_employee()) with check (is_employee())',
      t || '_employee_rw', t
    );
  end loop;
end $$;
