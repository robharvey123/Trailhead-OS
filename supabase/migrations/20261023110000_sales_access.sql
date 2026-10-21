-- ============================================================================
-- Sales Lead seat: database access control (Phase B). Idempotent.
-- Runs after 20261023100000_user_role_sales.sql.
--
-- Model
--   * role 'sales' is outside is_employee() / is_admin(), so every existing
--     employee/admin policy already denies it.
--   * Narrow PERMISSIVE policies grant exactly what the seat needs, scoped to
--     contacts carrying a sales tag (prefixes in sales_scope_tag_prefixes).
--   * A RESTRICTIVE "deny sales" policy goes on every other RLS table, so a
--     future loose policy (or an old one like "authenticated full access")
--     can't leak to the seat by accident.
--   * Product context and campaign names come through narrow definer views
--     that expose safe columns only.
-- Every helper that a policy on table T uses to read T is SECURITY DEFINER.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_sales() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_user_role() = 'sales'::public.user_role, false)
$$;

-- ---------------------------------------------------------------------------
-- Scope: which contacts the sales seat works. Rows are tag prefixes, matched
-- case-insensitively against contacts.tags.
-- ---------------------------------------------------------------------------
create table if not exists public.sales_scope_tag_prefixes (
  prefix text primary key check (length(btrim(prefix)) > 0),
  created_at timestamptz not null default now()
);
alter table public.sales_scope_tag_prefixes enable row level security;
drop policy if exists sales_scope_tag_prefixes_admin_rw on public.sales_scope_tag_prefixes;
create policy sales_scope_tag_prefixes_admin_rw on public.sales_scope_tag_prefixes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists sales_scope_tag_prefixes_sales_select on public.sales_scope_tag_prefixes;
create policy sales_scope_tag_prefixes_sales_select on public.sales_scope_tag_prefixes for select to authenticated
  using (public.is_sales());
insert into public.sales_scope_tag_prefixes (prefix) values ('Engineer OS'), ('MVP Cricket')
on conflict (prefix) do nothing;

create or replace function public.tags_in_sales_scope(p_tags text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from unnest(coalesce(p_tags, '{}'::text[])) t
    join public.sales_scope_tag_prefixes p
      on left(lower(btrim(t)), length(p.prefix)) = lower(p.prefix)
  )
$$;

create or replace function public.contact_in_sales_scope(p_contact_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contacts c
    where c.id = p_contact_id and c.merged_into is null and public.tags_in_sales_scope(c.tags)
  )
$$;

create or replace function public.outreach_recipient_in_sales_scope(p_recipient_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.outreach_recipients r
    where r.id = p_recipient_id and public.contact_in_sales_scope(r.contact_id)
  )
$$;

create or replace function public.outreach_send_in_sales_scope(p_send_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.outreach_sends s
    where s.id = p_send_id and public.outreach_recipient_in_sales_scope(s.recipient_id)
  )
$$;

create or replace function public.email_belongs_to_sales_contact(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contacts c
    where lower(c.email) = lower(btrim(p_email))
      and c.merged_into is null
      and public.tags_in_sales_scope(c.tags)
  )
$$;

-- The call-eligibility helpers (20261022110000) answer for any contact id.
-- Limit them to contacts the caller may see.
create or replace function public.contact_suppression_reason(p_contact_id uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select s.reason
  from public.contacts c
  join public.email_suppressions s on lower(s.email) = lower(c.email)
  where c.id = p_contact_id and c.email is not null
    and (coalesce(auth.role() = 'service_role', false) or public.is_employee() or public.contact_in_sales_scope(p_contact_id))
  order by case s.reason when 'complained' then 0 when 'unsubscribed' then 1 when 'bounced' then 2 else 3 end
  limit 1
$$;

create or replace function public.contact_recipient_stop_reason(p_contact_id uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select r.stopped_reason
  from public.outreach_recipients r
  where r.contact_id = p_contact_id
    and r.stopped_reason in ('unsubscribed', 'complained', 'bounced')
    and (coalesce(auth.role() = 'service_role', false) or public.is_employee() or public.contact_in_sales_scope(p_contact_id))
  order by case r.stopped_reason when 'complained' then 0 when 'unsubscribed' then 1 else 2 end
  limit 1
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'is_sales()', 'tags_in_sales_scope(text[])', 'contact_in_sales_scope(uuid)',
    'outreach_recipient_in_sales_scope(uuid)', 'outreach_send_in_sales_scope(uuid)',
    'email_belongs_to_sales_contact(text)'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Permissive grants for the seat
-- ---------------------------------------------------------------------------

-- contacts: read and update in-scope contacts only. No insert, no delete.
drop policy if exists contacts_sales_select on public.contacts;
create policy contacts_sales_select on public.contacts for select to authenticated
  using (public.is_sales() and merged_into is null and public.tags_in_sales_scope(tags));
drop policy if exists contacts_sales_update on public.contacts;
create policy contacts_sales_update on public.contacts for update to authenticated
  using (public.is_sales() and merged_into is null and public.tags_in_sales_scope(tags))
  with check (public.is_sales() and public.tags_in_sales_scope(tags));

-- touchpoints: read and log on in-scope contacts; never on accounts or engagements.
drop policy if exists touchpoints_sales_select on public.touchpoints;
create policy touchpoints_sales_select on public.touchpoints for select to authenticated
  using (public.is_sales() and contact_id is not null and public.contact_in_sales_scope(contact_id));
drop policy if exists touchpoints_sales_insert on public.touchpoints;
create policy touchpoints_sales_insert on public.touchpoints for insert to authenticated
  with check (
    public.is_sales()
    and contact_id is not null
    and account_id is null
    and engagement_id is null
    and public.contact_in_sales_scope(contact_id)
  );

-- outreach history for in-scope contacts: read only.
drop policy if exists outreach_recipients_sales_select on public.outreach_recipients;
create policy outreach_recipients_sales_select on public.outreach_recipients for select to authenticated
  using (public.is_sales() and public.contact_in_sales_scope(contact_id));
drop policy if exists outreach_sends_sales_select on public.outreach_sends;
create policy outreach_sends_sales_select on public.outreach_sends for select to authenticated
  using (public.is_sales() and public.outreach_recipient_in_sales_scope(recipient_id));
drop policy if exists outreach_events_sales_select on public.outreach_events;
create policy outreach_events_sales_select on public.outreach_events for select to authenticated
  using (public.is_sales() and send_id is not null and public.outreach_send_in_sales_scope(send_id));

-- email_suppressions: the seat can ADD an unsubscribe for one of its contacts,
-- never read the list or remove an entry.
drop policy if exists email_suppressions_sales_insert on public.email_suppressions;
create policy email_suppressions_sales_insert on public.email_suppressions for insert to authenticated
  with check (
    public.is_sales()
    and reason in ('unsubscribed', 'manual')
    and public.email_belongs_to_sales_contact(email)
  );

-- calendar: own events only (callbacks, demos), optionally linked to an
-- in-scope contact, never to an engagement or project.
drop policy if exists calendar_events_sales_rw on public.calendar_events;
create policy calendar_events_sales_rw on public.calendar_events for all to authenticated
  using (public.is_sales() and user_id = auth.uid())
  with check (
    public.is_sales()
    and user_id = auth.uid()
    and engagement_id is null
    and project_id is null
    and (contact_id is null or public.contact_in_sales_scope(contact_id))
  );

-- workstreams: the label list (contacts carry workstream_id).
drop policy if exists workstreams_sales_select on public.workstreams;
create policy workstreams_sales_select on public.workstreams for select to authenticated
  using (public.is_sales());

-- profiles: profiles_select / profiles_update_self already allow the seat its
-- own row; role and person_id changes are guarded below.

-- ---------------------------------------------------------------------------
-- Restrictive deny on everything else
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  allow text[] := array[
    'contacts', 'touchpoints', 'outreach_recipients', 'outreach_sends', 'outreach_events',
    'email_suppressions', 'calendar_events', 'workstreams', 'profiles', 'sales_scope_tag_prefixes'
  ];
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
  loop
    if r.relname = any (allow) then
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', r.relname || '_deny_sales', r.relname);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (not public.is_sales()) with check (not public.is_sales())',
      r.relname || '_deny_sales', r.relname
    );
  end loop;
end $$;

-- Storage: no bucket is for the seat.
drop policy if exists storage_objects_deny_sales on storage.objects;
create policy storage_objects_deny_sales on storage.objects as restrictive for all to authenticated
  using (not public.is_sales()) with check (not public.is_sales());

-- Definer RPCs that read time data answer nothing to the seat.
create or replace function public.task_time_summary(p_task_id uuid)
returns table(person_id uuid, full_name text, minutes bigint, billable_minutes bigint)
language sql stable security definer set search_path to 'public' as $$
  select te.person_id, coalesce(p.full_name, 'Unattributed') as full_name,
         sum(te.duration_minutes)::bigint as minutes,
         coalesce(sum(te.duration_minutes) filter (where te.billable), 0)::bigint as billable_minutes
  from time_entries te
  left join people p on p.id = te.person_id
  where te.task_id = p_task_id and te.is_running = false and te.duration_minutes > 0
    and not public.is_sales()
  group by te.person_id, p.full_name
  order by sum(te.duration_minutes) desc;
$$;

create or replace function public.tasks_time_summary(p_task_ids uuid[])
returns table(task_id uuid, minutes bigint, billable_minutes bigint)
language sql stable security definer set search_path to 'public' as $$
  select te.task_id, sum(te.duration_minutes)::bigint as minutes,
         coalesce(sum(te.duration_minutes) filter (where te.billable), 0)::bigint as billable_minutes
  from time_entries te
  where te.task_id = any(p_task_ids) and te.is_running = false and te.duration_minutes > 0
    and not public.is_sales()
  group by te.task_id;
$$;

-- ---------------------------------------------------------------------------
-- Write guards
-- ---------------------------------------------------------------------------

-- The seat may edit pipeline-ish fields on its contacts, but never the fields
-- that decide scope, compliance or identity: tags (scope), ctps_* (the call
-- gate), phone/email (would make a screened result or a suppression point at
-- the wrong number/address), merge and account/workstream links. It can SET
-- do_not_call / do_not_email but never clear them.
create or replace function public.contacts_sales_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_sales() then
    return new;
  end if;
  if new.tags is distinct from old.tags
     or new.ctps_registered is distinct from old.ctps_registered
     or new.ctps_checked_at is distinct from old.ctps_checked_at
     or new.phone is distinct from old.phone
     or new.email is distinct from old.email
     or new.merged_into is distinct from old.merged_into
     or new.merged_at is distinct from old.merged_at
     or new.account_id is distinct from old.account_id
     or new.workstream_id is distinct from old.workstream_id
     or (coalesce(old.do_not_call, false) and not coalesce(new.do_not_call, false))
     or (coalesce(old.do_not_email, false) and not coalesce(new.do_not_email, false))
  then
    raise exception 'The sales seat cannot change that field on a contact' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists contacts_sales_guard on public.contacts;
create trigger contacts_sales_guard before update on public.contacts
  for each row execute function public.contacts_sales_guard();

-- profiles: bring the role guard in line with production (service role and
-- migrations, which have no auth.uid(), may change roles), and stop anyone who
-- is not an admin re-pointing their own person_id (profiles_update_self
-- allowed it, which would let a login borrow another person's engagements,
-- time entries and tasks).
create or replace function public.enforce_profile_role_change() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null then
    return new; -- service role / backend
  end if;
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change a profile role';
  end if;
  if new.person_id is distinct from old.person_id and not public.is_admin() then
    raise exception 'Only admins can change a profile''s linked person';
  end if;
  return new;
end $$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard before update on public.profiles
  for each row execute function public.enforce_profile_role_change();

-- ---------------------------------------------------------------------------
-- Read-only product context and campaign names (definer views, safe columns)
-- ---------------------------------------------------------------------------
alter table public.projects add column if not exists sales_visible boolean not null default false;
comment on column public.projects.sales_visible is
  'Shown read-only to the sales seat as product context (name, status, phases, milestones only).';
update public.projects set sales_visible = true
where id in (
  'a7a8ef1d-4f81-48b1-82f1-539f9144f06c', -- Engineer OS
  '9a864507-f56f-476f-9035-e902855682de', -- MVP Cricket V2
  '6b901fe6-1716-4392-aecd-53631e9eb87d'  -- MVP Cricket: Before the First Ball
) and sales_visible = false;

create or replace function public.sales_view_allowed() returns boolean
language sql stable set search_path = '' as $$
  select current_user::text not in ('anon', 'authenticated') or public.is_employee() or public.is_sales()
$$;

create or replace view public.sales_products as
select p.id, coalesce(p.title, p.name) as name, p.description, p.status, p.start_date, p.end_date,
       p.estimated_end_date, p.colour, p.updated_at
from public.projects p
where p.sales_visible and public.sales_view_allowed();

create or replace view public.sales_product_phases as
select ph.id, ph.project_id, ph.name, ph.description, ph.sort_order, ph.start_date, ph.end_date
from public.project_phases ph
join public.projects p on p.id = ph.project_id
where p.sales_visible and public.sales_view_allowed();

create or replace view public.sales_product_milestones as
select m.id, m.project_id, coalesce(m.title, m.name) as name, m.description,
       coalesce(m.due_date, m.date) as due_date, m.status, m.completed, m.completed_at, m.order_index
from public.project_milestones m
join public.projects p on p.id = m.project_id
where p.sales_visible and public.sales_view_allowed();

create or replace view public.sales_campaigns as
select c.id, c.name, c.status
from public.outreach_campaigns c
where public.sales_view_allowed();

do $$
declare
  v text;
begin
  foreach v in array array['sales_products', 'sales_product_phases', 'sales_product_milestones', 'sales_campaigns']
  loop
    execute format('revoke all on public.%I from anon', v);
    execute format('grant select on public.%I to authenticated, service_role', v);
  end loop;
end $$;
