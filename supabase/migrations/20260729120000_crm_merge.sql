-- CRM merge — collapse a duplicate contact or account into another, keeping the
-- winner and archiving the loser. Every foreign key pointing at the target table
-- is discovered from the catalog (not a hand-maintained list) and repointed, so a
-- new FK added later is handled automatically. Composite-key join tables
-- (meeting_notes_contacts, meeting_contacts, outreach_recipients, account_tags, …)
-- would violate their unique constraint on repoint, so the loser's colliding row
-- is deleted first. Losers are archived, never deleted — history survives.

-- Bookkeeping columns.
alter table accounts add column if not exists target_role text;   -- promoted placeholder's role
alter table contacts add column if not exists merged_into uuid references contacts(id) on delete set null;
alter table contacts add column if not exists merged_at   timestamptz;
alter table accounts add column if not exists merged_into uuid references accounts(id) on delete set null;
alter table accounts add column if not exists merged_at   timestamptz;

-- Generic worker: repoint every single-column FK referencing `target` from
-- `loser` onto `winner`, deleting loser rows that would collide under a unique
-- or primary-key constraint that includes the FK column.
create or replace function crm_merge_generic(target regclass, winner uuid, loser uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fk    record;
  uq    record;
  child text;
  col   text;
  cond  text;
begin
  if winner is null or loser is null then raise exception 'winner and loser are required'; end if;
  if winner = loser then raise exception 'cannot merge a row into itself'; end if;

  for fk in
    select c.conrelid::regclass::text as child_table,
           att.attname                as fk_col
    from pg_constraint c
    join pg_attribute att on att.attrelid = c.conrelid and att.attnum = c.conkey[1]
    where c.confrelid = target
      and c.contype = 'f'
      and array_length(c.conkey, 1) = 1
  loop
    child := fk.child_table;
    col   := fk.fk_col;

    -- Resolve collisions against every unique/PK constraint on the child that
    -- includes this FK column: delete the loser row where an equivalent winner
    -- row already exists on the constraint's other columns.
    for uq in
      select array(
               select a.attname
               from unnest(c.conkey) k
               join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
               where a.attname <> col
             ) as other_cols
      from pg_constraint c
      where c.conrelid = child::regclass
        and c.contype in ('p', 'u')
        and exists (
          select 1 from unnest(c.conkey) k
          join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
          where a.attname = col
        )
    loop
      if array_length(uq.other_cols, 1) is null then
        execute format(
          'delete from %s d where d.%I = $1 and exists (select 1 from %s w where w.%I = $2)',
          child, col, child, col) using loser, winner;
      else
        cond := (
          select string_agg(format('w.%I is not distinct from d.%I', o, o), ' and ')
          from unnest(uq.other_cols) o
        );
        execute format(
          'delete from %s d where d.%I = $1 and exists (select 1 from %s w where w.%I = $2 and %s)',
          child, col, child, col, cond) using loser, winner;
      end if;
    end loop;

    execute format('update %s set %I = $1 where %I = $2', child, col, col) using winner, loser;
  end loop;
end;
$$;

create or replace function crm_merge_contacts(winner uuid, loser uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform crm_merge_generic('public.contacts'::regclass, winner, loser);
  update contacts set status = 'archived', merged_into = winner, merged_at = now() where id = loser;
end;
$$;

create or replace function crm_merge_accounts(winner uuid, loser uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform crm_merge_generic('public.accounts'::regclass, winner, loser);
  update accounts set status = 'archived', merged_into = winner, merged_at = now() where id = loser;
end;
$$;

-- The generic worker takes an arbitrary regclass, so keep it internal; only the
-- two typed wrappers (which pin the target) are callable by app users.
revoke all on function crm_merge_generic(regclass, uuid, uuid) from public;
grant execute on function crm_merge_contacts(uuid, uuid) to authenticated, service_role;
grant execute on function crm_merge_accounts(uuid, uuid) to authenticated, service_role;
