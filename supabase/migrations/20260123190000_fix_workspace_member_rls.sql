-- Fix workspace_members RLS recursion by using security definer helpers.

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

drop policy if exists workspace_members_select on public.workspace_members;
drop policy if exists workspace_members_insert on public.workspace_members;
drop policy if exists workspace_members_update on public.workspace_members;
drop policy if exists workspace_members_delete on public.workspace_members;

create policy workspace_members_select on public.workspace_members
  for select
  using (public.is_workspace_member(workspace_id));

create policy workspace_members_insert on public.workspace_members
  for insert
  with check (public.is_workspace_admin(workspace_id));

create policy workspace_members_update on public.workspace_members
  for update
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create policy workspace_members_delete on public.workspace_members
  for delete
  using (public.is_workspace_admin(workspace_id));
