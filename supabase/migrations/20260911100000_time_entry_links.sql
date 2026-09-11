-- ============================================================================
-- Unified time recording — link consistency for time_entries.
--
-- Every writer (timesheet form, timers, Cowork API, SQL) must produce a row
-- that carries engagement, project, account and person whenever they are
-- derivable. Audit on 10 Sep 2026: 56 of 75 completed rows had no account_id
-- (54 of those had an engagement), so account-scoped invoicing never saw them.
--
-- Rate resolution stays in TypeScript (lib/time/links.ts): this trigger fills
-- LINKS only and never touches rate_snapshot, billed or invoice_id.
-- Runs after 20260910100000_engagement_billing_months.sql.
-- ============================================================================

-- 1a. Login profile → person link (the admin profile had person_id null while
--     the owner profile carried it; startTimer reads profiles.person_id).
-- people.auth_user_id is the source of truth for "which login is this person"
-- (the fill-links trigger below and owner_person_id() both resolve through it).
-- profiles.person_id is UNIQUE, so first release the person from any profile
-- whose auth user is NOT the one people.auth_user_id names, then link the right one.
update profiles p
set person_id = null
from people pe
where p.person_id = pe.id
  and pe.auth_user_id is not null
  and pe.auth_user_id <> p.id;

update profiles p
set person_id = pe.id
from people pe
where pe.auth_user_id = p.id
  and p.person_id is distinct from pe.id;

-- 1b. Fill missing links on insert/update.
create or replace function time_entries_fill_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t_eng  uuid;
  t_proj uuid;
  p_eng  uuid;
  p_acct uuid;
  e_acct uuid;
  e_bill boolean;
begin
  -- task → engagement + project
  if new.task_id is not null then
    select engagement_id, project_id into t_eng, t_proj from engagement_tasks where id = new.task_id;
    if found then
      if new.engagement_id is null then new.engagement_id := t_eng; end if;
      if new.project_id   is null then new.project_id   := t_proj; end if;
    end if;
  end if;

  -- project → engagement + account
  if new.project_id is not null then
    select engagement_id, account_id into p_eng, p_acct from projects where id = new.project_id;
    if found then
      if new.engagement_id is null then new.engagement_id := p_eng; end if;
      if new.account_id    is null then new.account_id    := p_acct; end if;
    end if;
  end if;

  -- engagement → account (end client); timer rows default billable from the engagement
  if new.engagement_id is not null then
    select end_client_account_id, is_billable into e_acct, e_bill from engagements where id = new.engagement_id;
    if found then
      if new.account_id is null then new.account_id := e_acct; end if;
      if tg_op = 'INSERT' and new.source = 'timer' and new.is_running then
        new.billable := coalesce(e_bill, true);
      end if;
    end if;
  end if;

  -- user → person
  if new.person_id is null and new.user_id is not null then
    select id into new.person_id from people where auth_user_id = new.user_id limit 1;
  end if;

  return new;
end $$;

revoke all on function time_entries_fill_links() from public;

drop trigger if exists time_entries_fill_links on time_entries;
create trigger time_entries_fill_links
  before insert or update of task_id, project_id, engagement_id, account_id, person_id, user_id
  on time_entries
  for each row execute function time_entries_fill_links();

-- 1c. Backfill existing rows through the same logic (a self-assignment of a
--     watched column fires the trigger).
update time_entries set task_id = task_id
where account_id is null or project_id is null or engagement_id is null or person_id is null;

-- 1d. Contradiction guard: a task must belong to the engagement the entry names.
create or replace function time_entries_task_engagement_agree(p_task uuid, p_eng uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_task is null or p_eng is null
      or exists (
        select 1 from engagement_tasks
        where id = p_task and (engagement_id is null or engagement_id = p_eng)
      );
$$;

alter table time_entries drop constraint if exists time_entries_task_engagement_agree;
alter table time_entries add constraint time_entries_task_engagement_agree
  check (time_entries_task_engagement_agree(task_id, engagement_id)) not valid;
alter table time_entries validate constraint time_entries_task_engagement_agree;

-- 1e. Ledger indexes.
create index if not exists idx_time_entries_eng_date  on time_entries (engagement_id, entry_date) where is_running = false;
create index if not exists idx_time_entries_proj_date on time_entries (project_id, entry_date)    where is_running = false;
