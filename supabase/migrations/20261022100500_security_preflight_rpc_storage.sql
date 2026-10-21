-- ============================================================================
-- Security preflight, part 2 (S8, S9). Idempotent. Runs after 20261022100000.
--
-- S8  Storage buckets engagement-docs and receipts let ANY authenticated user
--     read, upload and delete. Locked to is_employee(), like their tables.
-- S9  SECURITY DEFINER functions run with the owner's rights and were
--     executable by anon. The CRM merge functions had no caller check at all,
--     so the public anon key could merge (and archive) contacts or accounts.
--     anon loses EXECUTE on every data function; the merges also check the
--     caller, because authenticated is not the same as staff.
--     Policy predicates (is_admin, is_employee, ...) keep their grants: RLS
--     evaluates them as the caller, and revoking them would turn "no rows"
--     into permission errors on public forms.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- S8: storage
-- ---------------------------------------------------------------------------
do $$
declare
  b text;
begin
  foreach b in array array['engagement-docs', 'receipts']
  loop
    execute format('drop policy if exists %I on storage.objects', 'authenticated can read ' || replace(b, '-', ' '));
    execute format('drop policy if exists %I on storage.objects', 'authenticated can upload ' || replace(b, '-', ' '));
    execute format('drop policy if exists %I on storage.objects', 'authenticated can delete ' || replace(b, '-', ' '));
    execute format('drop policy if exists %I on storage.objects', b || '_employee_select');
    execute format('drop policy if exists %I on storage.objects', b || '_employee_insert');
    execute format('drop policy if exists %I on storage.objects', b || '_employee_delete');
    execute format('create policy %I on storage.objects for select to authenticated using (bucket_id = %L and public.is_employee())', b || '_employee_select', b);
    execute format('create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and public.is_employee())', b || '_employee_insert', b);
    execute format('create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and public.is_employee())', b || '_employee_delete', b);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- S9a: the CRM merges check the caller. Bodies are unchanged apart from the
-- guard (crm_merge_generic is guarded too, as it is callable directly).
-- ---------------------------------------------------------------------------
create or replace function public.crm_caller_is_staff() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.role() = 'service_role', false) or public.is_employee()
$$;

do $$
declare
  fn text;
  def text;
begin
  foreach fn in array array['crm_merge_generic(regclass,uuid,uuid)', 'crm_merge_contacts(uuid,uuid)', 'crm_merge_accounts(uuid,uuid)']
  loop
    if to_regprocedure('public.' || fn) is null then
      continue;
    end if;
    def := pg_get_functiondef(to_regprocedure('public.' || fn));
    if position('crm_caller_is_staff' in def) > 0 then
      continue; -- already guarded
    end if;
    -- Insert the guard right after the first "begin" of the plpgsql body.
    def := regexp_replace(
      def,
      '(\$function\$\s*(declare.*?)?begin)',
      E'\\1\n  if not public.crm_caller_is_staff() then raise exception ''not authorised'' using errcode = ''42501''; end if;',
      'is'
    );
    execute def;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- S9b: no data function is for anon. (count_recent_enquiries and
-- count_recent_public_form_events are called by the public form routes with
-- the anon client, so they keep their grant.)
-- ---------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'crm_merge_generic(regclass,uuid,uuid)', 'crm_merge_contacts(uuid,uuid)', 'crm_merge_accounts(uuid,uuid)',
    'dm_directory()', 'task_time_summary(uuid)', 'tasks_time_summary(uuid[])',
    'time_entries_task_engagement_agree(uuid,uuid)', 'invoice_seq_peek()', 'invoice_seq_restore(bigint,boolean)'
  ]
  loop
    if to_regprocedure('public.' || fn) is not null then
      execute format('revoke execute on function public.%s from public, anon', fn);
      execute format('grant execute on function public.%s to authenticated, service_role', fn);
    end if;
  end loop;
end $$;

-- invoice sequence helpers were never meant for client roles at all.
do $$
begin
  if to_regprocedure('public.invoice_seq_peek()') is not null then
    revoke execute on function public.invoice_seq_peek() from authenticated;
  end if;
  if to_regprocedure('public.invoice_seq_restore(bigint,boolean)') is not null then
    revoke execute on function public.invoice_seq_restore(bigint, boolean) from authenticated;
  end if;
end $$;
