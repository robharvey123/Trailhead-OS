-- ============================================================================
-- Sales pipeline and call outcomes (Phase C). Idempotent.
--
-- contacts gain a pipeline (stage, owner, next action, lost/disqualified
-- reasons, recontact date, Engineer OS org id, size rank).
-- touchpoints become the outcome log: `type` doubles as the channel (adds
-- demo, linkedin), plus outcome_code, duration and who logged it. `subject`
-- carries the outcome label and `body` the summary.
--
-- All stage rules live in two SECURITY INVOKER functions, so the caller's RLS
-- applies and the sales UI and the MCP tools share one implementation:
--   log_sales_outcome(...)   one call outcome + the transition it implies
--   set_pipeline_stage(...)  a manual stage move (kanban drag)
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'contact_pipeline_stage') then
    create type public.contact_pipeline_stage as enum
      ('new', 'contacted', 'conversation', 'demo_booked', 'trial', 'customer', 'disqualified', 'lost');
  end if;
  if not exists (select 1 from pg_type where typname = 'sales_outcome_code') then
    create type public.sales_outcome_code as enum
      ('NA', 'VM', 'GK', 'CB', 'CONV', 'DEMO', 'TRIAL', 'WON', 'DQ', 'LOST');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
alter table public.contacts add column if not exists pipeline_stage public.contact_pipeline_stage not null default 'new';
alter table public.contacts add column if not exists owner_user_id uuid references auth.users(id) on delete set null;
alter table public.contacts add column if not exists next_action_at timestamptz;
alter table public.contacts add column if not exists next_action_note text;
alter table public.contacts add column if not exists lost_reason text;
alter table public.contacts add column if not exists disqualified_reason text;
alter table public.contacts add column if not exists recontact_after date;
alter table public.contacts add column if not exists engineer_os_org_id text;
alter table public.contacts add column if not exists size_rank smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_size_rank_range') then
    alter table public.contacts add constraint contacts_size_rank_range check (size_rank is null or size_rank between 1 and 4);
  end if;
end $$;

comment on column public.contacts.size_rank is '1 (smallest) to 4 (largest), derived from size_signal. Orders the cold call queue.';
comment on column public.contacts.engineer_os_org_id is 'Engineer OS tenant slug or org id once the firm starts a trial. Manual for now.';

create index if not exists idx_contacts_pipeline_stage on public.contacts (pipeline_stage);
create index if not exists idx_contacts_next_action_at on public.contacts (next_action_at) where next_action_at is not null;
create index if not exists idx_contacts_owner_user_id on public.contacts (owner_user_id);

-- ---------------------------------------------------------------------------
-- touchpoints as the outcome log
-- ---------------------------------------------------------------------------
alter table public.touchpoints drop constraint if exists touchpoints_type_check;
alter table public.touchpoints add constraint touchpoints_type_check
  check (type in ('call', 'email', 'message', 'meeting', 'note', 'demo', 'linkedin'));

alter table public.touchpoints add column if not exists outcome_code public.sales_outcome_code;
alter table public.touchpoints add column if not exists duration_seconds integer;
alter table public.touchpoints add column if not exists logged_by_user_id uuid references auth.users(id) on delete set null default auth.uid();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'touchpoints_duration_nonnegative') then
    alter table public.touchpoints add constraint touchpoints_duration_nonnegative check (duration_seconds is null or duration_seconds >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'touchpoints_outcome_needs_summary') then
    alter table public.touchpoints add constraint touchpoints_outcome_needs_summary
      check (outcome_code is null or outcome_code not in ('CONV', 'DEMO', 'DQ', 'LOST') or nullif(btrim(coalesce(body, '')), '') is not null);
  end if;
end $$;

create index if not exists idx_touchpoints_contact_occurred on public.touchpoints (contact_id, occurred_at desc);
create index if not exists idx_touchpoints_outcome_occurred on public.touchpoints (outcome_code, occurred_at) where outcome_code is not null;

-- ---------------------------------------------------------------------------
-- The seat may claim an unowned contact or release its own, never take or
-- reassign someone else's. Everything else as in 20261023110000.
-- ---------------------------------------------------------------------------
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
  if new.owner_user_id is distinct from old.owner_user_id
     and not (old.owner_user_id is null and new.owner_user_id = auth.uid())
     and not (old.owner_user_id = auth.uid() and new.owner_user_id is null)
  then
    raise exception 'The sales seat can only claim an unowned contact or release its own' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Stage ordering helper (forward moves never regress a contact).
-- ---------------------------------------------------------------------------
create or replace function public.pipeline_stage_rank(p public.contact_pipeline_stage) returns int
language sql immutable set search_path = '' as $$
  select case p
    when 'disqualified' then -1 when 'lost' then -1
    when 'new' then 0 when 'contacted' then 1 when 'conversation' then 2
    when 'demo_booked' then 3 when 'trial' then 4 when 'customer' then 5
  end
$$;

create or replace function public.sales_outcome_label(p public.sales_outcome_code) returns text
language sql immutable set search_path = '' as $$
  select case p
    when 'NA' then 'No answer' when 'VM' then 'Voicemail' when 'GK' then 'Gatekeeper'
    when 'CB' then 'Callback booked' when 'CONV' then 'Conversation' when 'DEMO' then 'Demo booked'
    when 'TRIAL' then 'Trial started' when 'WON' then 'Won' when 'DQ' then 'Disqualified' when 'LOST' then 'Lost'
  end
$$;

-- ---------------------------------------------------------------------------
-- log_sales_outcome: one outcome and the transition it implies.
--   NA / VM / GK : new -> contacted
--   CB           : next_action_at required; new -> contacted
--   CONV         : new / contacted / lost / disqualified -> conversation
--   DEMO         : -> demo_booked (never backwards); with a date, a calendar
--                  entry for the logger and next_action_at = the demo
--   TRIAL        : -> trial (never backwards)
--   WON          : -> customer
--   DQ           : -> disqualified, reason required
--   LOST         : -> lost, reason required, recontact_after defaults +180 days
-- Summary is required for CONV, DEMO, DQ and LOST. Logging any outcome
-- without a new date clears a callback that has come due. The logger claims
-- the contact if it is unowned.
-- ---------------------------------------------------------------------------
create or replace function public.log_sales_outcome(
  p_contact_id uuid,
  p_outcome public.sales_outcome_code,
  p_summary text default null,
  p_channel text default 'call',
  p_next_action_at timestamptz default null,
  p_next_action_note text default null,
  p_duration_seconds integer default null,
  p_reason text default null,
  p_logged_by uuid default null,
  p_recontact_after date default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  c record;
  v_by uuid := coalesce(p_logged_by, auth.uid());
  v_summary text := nullif(btrim(coalesce(p_summary, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_note text := nullif(btrim(coalesce(p_next_action_note, '')), '');
  v_new public.contact_pipeline_stage;
  v_next timestamptz;
  v_tp uuid;
  v_event uuid;
begin
  if v_by is null then
    raise exception 'logged_by is required' using errcode = '22023';
  end if;
  if auth.uid() is not null and v_by <> auth.uid() then
    raise exception 'You can only log outcomes as yourself' using errcode = '42501';
  end if;
  if p_channel not in ('call', 'email', 'demo', 'meeting', 'linkedin') then
    raise exception 'Unknown channel %', p_channel using errcode = '22023';
  end if;
  if p_outcome in ('CONV', 'DEMO', 'DQ', 'LOST') and v_summary is null then
    raise exception 'Add a summary of what they said' using errcode = '22023';
  end if;
  if p_outcome in ('DQ', 'LOST') and v_reason is null then
    raise exception 'A reason is required for %', public.sales_outcome_label(p_outcome) using errcode = '22023';
  end if;
  if p_outcome = 'CB' and p_next_action_at is null then
    raise exception 'Pick a callback date and time' using errcode = '22023';
  end if;
  if p_duration_seconds is not null and p_duration_seconds < 0 then
    raise exception 'Duration cannot be negative' using errcode = '22023';
  end if;

  select ct.id, ct.company, ct.name, ct.pipeline_stage, ct.owner_user_id, ct.next_action_at
    into c
  from public.contacts ct
  where ct.id = p_contact_id and ct.merged_into is null
  for update;
  if not found then
    raise exception 'Contact not found' using errcode = 'P0002';
  end if;

  v_new := case p_outcome
    when 'NA' then case when c.pipeline_stage = 'new' then 'contacted' else c.pipeline_stage end
    when 'VM' then case when c.pipeline_stage = 'new' then 'contacted' else c.pipeline_stage end
    when 'GK' then case when c.pipeline_stage = 'new' then 'contacted' else c.pipeline_stage end
    when 'CB' then case when c.pipeline_stage = 'new' then 'contacted' else c.pipeline_stage end
    when 'CONV' then case when public.pipeline_stage_rank(c.pipeline_stage) < 2 then 'conversation' else c.pipeline_stage end
    when 'DEMO' then case when public.pipeline_stage_rank(c.pipeline_stage) < 3 then 'demo_booked' else c.pipeline_stage end
    when 'TRIAL' then case when public.pipeline_stage_rank(c.pipeline_stage) < 4 then 'trial' else c.pipeline_stage end
    when 'WON' then 'customer'
    when 'DQ' then 'disqualified'
    when 'LOST' then 'lost'
  end;

  v_next := case
    when p_next_action_at is not null then p_next_action_at
    when p_outcome in ('WON', 'DQ', 'LOST') then null
    when c.next_action_at is not null and c.next_action_at <= now() then null
    else c.next_action_at
  end;

  if p_outcome = 'DEMO' and p_next_action_at is not null then
    insert into public.calendar_events (title, description, start_at, end_at, all_day, contact_id, user_id, source)
    values (
      'Demo: ' || coalesce(c.company, c.name),
      v_summary,
      p_next_action_at,
      p_next_action_at + interval '30 minutes',
      false,
      c.id,
      v_by,
      'manual'
    )
    returning id into v_event;
  end if;

  insert into public.touchpoints (contact_id, type, subject, body, occurred_at, outcome_code, duration_seconds, logged_by_user_id, event_id)
  values (
    c.id,
    p_channel,
    public.sales_outcome_label(p_outcome),
    concat_ws(E'\n\n', v_summary, case when v_reason is not null then 'Reason: ' || v_reason end,
              case when p_outcome = 'CB' then 'Callback: ' || to_char(p_next_action_at at time zone 'Europe/London', 'Dy DD Mon HH24:MI') end),
    now(),
    p_outcome,
    p_duration_seconds,
    v_by,
    v_event
  )
  returning id into v_tp;

  update public.contacts ct set
    pipeline_stage = v_new,
    owner_user_id = coalesce(ct.owner_user_id, v_by),
    next_action_at = v_next,
    next_action_note = case when p_next_action_at is not null then v_note
                            when v_next is null then null
                            else ct.next_action_note end,
    disqualified_reason = case when p_outcome = 'DQ' then v_reason else ct.disqualified_reason end,
    lost_reason = case when p_outcome = 'LOST' then v_reason else ct.lost_reason end,
    recontact_after = case when p_outcome = 'LOST' then coalesce(p_recontact_after, current_date + 180)
                           when p_outcome in ('CONV', 'DEMO', 'TRIAL', 'WON') then null
                           else ct.recontact_after end,
    updated_at = now()
  where ct.id = c.id;

  return jsonb_build_object(
    'touchpoint_id', v_tp,
    'stage_before', c.pipeline_stage,
    'stage_after', v_new,
    'next_action_at', v_next,
    'calendar_event_id', v_event
  );
end $$;

-- ---------------------------------------------------------------------------
-- set_pipeline_stage: a manual move (kanban drag). Same reason rules.
-- ---------------------------------------------------------------------------
create or replace function public.set_pipeline_stage(
  p_contact_id uuid,
  p_stage public.contact_pipeline_stage,
  p_reason text default null,
  p_logged_by uuid default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  c record;
  v_by uuid := coalesce(p_logged_by, auth.uid());
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_by is null then
    raise exception 'logged_by is required' using errcode = '22023';
  end if;
  if auth.uid() is not null and v_by <> auth.uid() then
    raise exception 'You can only move contacts as yourself' using errcode = '42501';
  end if;
  if p_stage in ('disqualified', 'lost') and v_reason is null then
    raise exception 'A reason is required to mark a contact %', p_stage using errcode = '22023';
  end if;

  select ct.id, ct.pipeline_stage into c
  from public.contacts ct
  where ct.id = p_contact_id and ct.merged_into is null
  for update;
  if not found then
    raise exception 'Contact not found' using errcode = 'P0002';
  end if;
  if c.pipeline_stage = p_stage then
    return jsonb_build_object('stage_before', c.pipeline_stage, 'stage_after', p_stage, 'changed', false);
  end if;

  update public.contacts ct set
    pipeline_stage = p_stage,
    owner_user_id = coalesce(ct.owner_user_id, v_by),
    disqualified_reason = case when p_stage = 'disqualified' then v_reason else ct.disqualified_reason end,
    lost_reason = case when p_stage = 'lost' then v_reason else ct.lost_reason end,
    recontact_after = case when p_stage = 'lost' then coalesce(ct.recontact_after, current_date + 180)
                           when p_stage in ('conversation', 'demo_booked', 'trial', 'customer') then null
                           else ct.recontact_after end,
    next_action_at = case when p_stage in ('customer', 'disqualified', 'lost') then null else ct.next_action_at end,
    updated_at = now()
  where ct.id = c.id;

  -- Moves that are themselves results carry the matching outcome code, so the
  -- dashboard counts a drag to Lost the same as a logged LOST.
  insert into public.touchpoints (contact_id, type, subject, body, occurred_at, logged_by_user_id, outcome_code)
  values (
    c.id, 'note',
    'Stage: ' || replace(c.pipeline_stage::text, '_', ' ') || ' to ' || replace(p_stage::text, '_', ' '),
    case when v_reason is not null then 'Reason: ' || v_reason end,
    now(), v_by,
    case p_stage
      when 'trial' then 'TRIAL'::public.sales_outcome_code
      when 'customer' then 'WON'::public.sales_outcome_code
      when 'disqualified' then 'DQ'::public.sales_outcome_code
      when 'lost' then 'LOST'::public.sales_outcome_code
    end
  );

  return jsonb_build_object('stage_before', c.pipeline_stage, 'stage_after', p_stage, 'changed', true);
end $$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'log_sales_outcome(uuid,public.sales_outcome_code,text,text,timestamptz,text,integer,text,uuid,date)',
    'set_pipeline_stage(uuid,public.contact_pipeline_stage,text,uuid)',
    'pipeline_stage_rank(public.contact_pipeline_stage)',
    'sales_outcome_label(public.sales_outcome_code)'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;
