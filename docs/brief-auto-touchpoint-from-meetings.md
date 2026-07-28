# Brief: auto-create touchpoints from meetings (and later, Gmail threads)

## Goal

When a synced meeting is matched to an account that belongs to an engagement,
create a `touchpoint` (type `meeting`) against that engagement automatically, so
the engagement Timeline fills itself without anyone logging by hand. Must be
idempotent — the Granola sync runs on a cron and re-processes notes, so re-runs
must never create duplicate touchpoints.

## Context the agent needs

- Meetings land in `meetings` via `lib/granola-sync.ts` (`upsertMeeting` +
  `linkMeeting`). `linkMeeting` sets `meetings.account_id` from the first matched
  contact's account. The generic matcher is `lib/meetings/match.ts` (email →
  contact → account by domain, with a `confidence`/`needsReview` signal).
- `touchpoints` now has `engagement_id` (migration `20260728160000`), plus
  `account_id`, `contact_id`, `type`, `subject`, `body`, `occurred_at`. There is
  currently **no** external-source column, so nothing dedupes an auto-created row.
- Engagements relate to accounts via `end_client_account_id` and
  `billed_via_account_id`. `lib/db/engagements.ts` already has
  `engagementAccountIds(detail)`; a reverse lookup (account → engagements) needs a
  small helper.

## Changes

### 1. Migration — touchpoint source/idempotency

```sql
alter table touchpoints
  add column if not exists source text,        -- 'granola' | 'gmail' | null (manual/API)
  add column if not exists source_id text;     -- meeting id / gmail thread id

-- One auto touchpoint per source object. Partial unique so manual rows (source
-- null) are unaffected.
create unique index if not exists idx_touchpoints_source
  on touchpoints (source, source_id) where source is not null;
```

### 2. Reverse lookup — account → engagement

Add to `lib/db/engagements.ts`:

```ts
// The engagement an account belongs to, most-recent non-terminal first, or null.
export async function engagementForAccount(accountId: string, client?): Promise<{ id: string } | null>
```

Query `engagements` where `end_client_account_id = accountId OR billed_via_account_id = accountId`,
exclude terminal statuses (reuse `TERMINAL_ENGAGEMENT_STATUSES`), order by
`created_at desc`, limit 1. When an account is on more than one live engagement,
newest wins (log it; do not fan out to all).

### 3. Hook into the sync

In `lib/granola-sync.ts`, after `linkMeeting` has resolved `meetings.account_id`
for a note, if that account maps to an engagement, upsert a touchpoint:

```ts
await supabaseService.from('touchpoints').upsert({
  source: 'granola',
  source_id: meeting.id,
  engagement_id: eng.id,
  account_id: meeting.account_id,
  type: 'meeting',
  subject: note.title,
  body: <short summary/first N chars of notes, if available>,
  occurred_at: <meeting start>,
}, { onConflict: 'source,source_id' })
```

- Only when `meeting.account_id` is set AND resolves to an engagement. No account
  → no touchpoint (do not guess).
- Idempotent via the `(source, source_id)` unique index; a re-sync updates the
  same row (title/notes may have been edited in Granola).
- Do NOT write to the Cowork activity log for these — they are system-synced, not
  a Cowork/MCP action (same rule as UI-created rows).

### 4. Surface the source in the timeline (optional, small)

`TouchpointTimeline` can show a muted "from Granola" chip when `source` is set, so
it's clear the row was auto-captured rather than hand-logged. Add `source` to the
timeline row type and the OS/engagement selects.

## Verify

1. A Granola meeting with an external attendee whose domain matches an
   engagement's account creates exactly one `meeting` touchpoint on that
   engagement. Re-running the sync does not create a second.
2. Editing the meeting title in Granola and re-syncing updates the existing
   touchpoint, not a new one.
3. A meeting with no account match creates no touchpoint.
4. The engagement Timeline shows the auto-captured meeting (with the source chip
   if 4 is done); it does not appear in `GET /api/cowork/activity`.

## Watch out for

- **Idempotency is the whole point.** Without the `(source, source_id)` unique
  index + `onConflict`, the cron will duplicate touchpoints every run.
- **`meetings.account_id` is set asynchronously** by `linkMeeting` — read it back
  from the upsert result before deciding, don't assume the incoming note has it.
- **Confidence.** `match.ts` flags low-confidence links via `needsReview`. Consider
  only auto-creating on `confidence >= medium` to avoid mis-filing a meeting onto
  the wrong engagement; leave the rest for manual logging.

## Follow-up, not in this brief

- Gmail threads → touchpoints (type `email`). `lib/google/gmail-sync.ts` has no
  engagement linkage today and Gmail volume is far higher than meetings, so it
  needs its own matching + throttling design. Do meetings first.
