-- ============================================================================
-- Sender identity and one-to-one follow-up emails (Phase E). Idempotent.
--
-- * os_company_settings.verified_sending_domains: the domains a person may
--   send follow-ups from. A sender identity is accepted only if its domain is
--   in this list AND Resend reports the domain verified.
-- * user_sender_identities: each user's own from name / from email / reply-to.
-- * sales_follow_up_sends: every one-to-one follow-up, keyed by Resend email
--   id so the existing webhook can attach delivered / opened / clicked.
-- Campaign (bulk) sending is untouched and stays owner-only.
-- ============================================================================

alter table public.os_company_settings
  add column if not exists verified_sending_domains text[] not null default '{}';
comment on column public.os_company_settings.verified_sending_domains is
  'Domains allowed for personal sender identities (follow-up emails). Must also be verified in Resend.';

create table if not exists public.user_sender_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  from_name text not null check (length(btrim(from_name)) between 1 and 80),
  from_email text not null check (from_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  reply_to text check (reply_to is null or reply_to ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  updated_at timestamptz not null default now()
);
alter table public.user_sender_identities enable row level security;

drop policy if exists user_sender_identities_own on public.user_sender_identities;
create policy user_sender_identities_own on public.user_sender_identities for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists user_sender_identities_admin_select on public.user_sender_identities;
create policy user_sender_identities_admin_select on public.user_sender_identities for select to authenticated
  using (public.is_admin());

create table if not exists public.sales_follow_up_sends (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  touchpoint_id uuid references public.touchpoints(id) on delete set null,
  resend_email_id text unique,
  to_email text not null,
  from_email text not null,
  subject text not null,
  body_text text,
  status text not null default 'sent' check (status in ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed')),
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  first_opened_at timestamptz,
  first_clicked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_sales_follow_up_sends_contact on public.sales_follow_up_sends (contact_id, sent_at desc);
create index if not exists idx_sales_follow_up_sends_user_day on public.sales_follow_up_sends (user_id, sent_at);

alter table public.sales_follow_up_sends enable row level security;
-- Rows are written by the server (service role) after it has authorised the
-- sender; signed-in users only read.
drop policy if exists sales_follow_up_sends_employee_select on public.sales_follow_up_sends;
create policy sales_follow_up_sends_employee_select on public.sales_follow_up_sends for select to authenticated
  using (public.is_employee());
drop policy if exists sales_follow_up_sends_sales_select on public.sales_follow_up_sends;
create policy sales_follow_up_sends_sales_select on public.sales_follow_up_sends for select to authenticated
  using (public.is_sales() and public.contact_in_sales_scope(contact_id));

revoke all on public.user_sender_identities from anon;
revoke all on public.sales_follow_up_sends from anon;
