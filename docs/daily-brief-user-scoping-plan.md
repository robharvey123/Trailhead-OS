# Daily Brief User Scoping Plan

## Current State

The OS dashboard now renders a daily brief, but the underlying OS records are still effectively shared across the authenticated OS.

Current gaps:

- `tasks` has `owner` as free text, not a user foreign key.
- `calendar_events` has no `user_id` or owner field.
- `quotes` has `created_by_id`, but existing rows may be null.
- `projects` has `owner_id`, but existing rows may be null and the daily brief does not currently consume project deadlines.
- RLS for OS tables is broad authenticated access, not per-user ownership.

## Goal

Support strict user-scoped daily brief queries without changing the dashboard UI.

Target rule set:

- Action-required tasks: only tasks assigned to the current user.
- Today tasks: only tasks assigned to the current user.
- Quotes needing attention: only quotes created by the current user.
- Week-ahead events: only events owned by or explicitly linked to the current user.

## Minimal Schema Changes

### 1. Tasks

Add a real owner relation.

```sql
alter table tasks
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_tasks_owner_user_id on tasks(owner_user_id);
```

Keep the existing `owner` text column for display if needed, but stop using it as the source of truth.

### 2. Calendar Events

Add a direct user owner relation.

```sql
alter table calendar_events
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_calendar_events_user_id on calendar_events(user_id);
```

This is the smallest change that makes the week-ahead event query strict and simple.

### 3. Quotes

No new column is required. `created_by_id` already exists.

Required cleanup:

- backfill null `created_by_id` values for existing quotes
- require `created_by_id` on create going forward

### 4. Projects

No extra column is required for the dashboard itself. `owner_id` already exists.

Only use this if project deadlines are added to the brief later.

## Backfill Plan

Because the OS is currently single-user, the cleanest backfill is to assign legacy rows to the single authenticated owner.

Example approach:

1. Identify the canonical OS user id.
2. Backfill legacy rows:

```sql
update tasks
set owner_user_id = '<USER_ID>'
where owner_user_id is null;

update calendar_events
set user_id = '<USER_ID>'
where user_id is null;

update quotes
set created_by_id = '<USER_ID>'
where created_by_id is null;

update projects
set owner_id = '<USER_ID>'
where owner_id is null;
```

3. Once backfilled, tighten constraints if desired.

Optional follow-up:

```sql
alter table tasks alter column owner_user_id set not null;
alter table calendar_events alter column user_id set not null;
alter table quotes alter column created_by_id set not null;
```

Only do this after verifying the data migration.

## Query Changes

### Daily Brief Data Layer

Update [lib/db/daily-brief.ts](lib/db/daily-brief.ts) as follows:

- tasks query: add `.eq('owner_user_id', userId)`
- quotes query: replace the current null-tolerant filter with `.eq('created_by_id', userId)`
- calendar events query: add `.eq('user_id', userId)`

### Task Mutations

Update task creation paths to always write `owner_user_id`.

Relevant files:

- [app/api/os/tasks/route.ts](app/api/os/tasks/route.ts)
- [lib/db/tasks.ts](lib/db/tasks.ts)

Recommended behavior:

- default `owner_user_id` to the authenticated user on create
- allow reassignment later only if the OS becomes multi-user

### Quote Mutations

Ensure quote creation always persists `created_by_id` from the authenticated user.

Relevant files:

- [app/api/quotes/route.ts](app/api/quotes/route.ts)
- [lib/db/quotes.ts](lib/db/quotes.ts)

### Calendar Event Mutations

Ensure event creation always persists `user_id` from the authenticated user.

Relevant files:

- [lib/db/calendar-events.ts](lib/db/calendar-events.ts)
- any event creation route using that helper

## RLS Tightening

This can be done in two stages.

### Stage 1. Keep current authenticated access

Do this while the app is still functionally single-user and data is being backfilled.

### Stage 2. Add ownership-aware policies

Example direction:

```sql
create policy tasks_owner_access on tasks
  for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy calendar_events_owner_access on calendar_events
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy quotes_owner_access on quotes
  for all
  using (created_by_id = auth.uid())
  with check (created_by_id = auth.uid());
```

Only apply this once every write path is setting ownership correctly.

## Recommended Rollout Order

1. Add `tasks.owner_user_id` and `calendar_events.user_id`.
2. Backfill all legacy rows to the existing single OS user.
3. Update create and update code paths to persist ownership fields automatically.
4. Tighten [lib/db/daily-brief.ts](lib/db/daily-brief.ts) to strict equality filters.
5. Verify the dashboard still renders the same records for the current user.
6. Tighten RLS only after the application writes are stable.

## Why This Is Minimal

This plan avoids changing the dashboard UI or reshaping the brief response.

It only introduces:

- one user foreign key on tasks
- one user foreign key on calendar events
- a backfill for existing rows
- stricter query filters in the existing daily brief data layer

That is the smallest path from the current single-user OS model to strict user-scoped brief queries.