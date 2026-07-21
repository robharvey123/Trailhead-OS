import Link from 'next/link'
import { mockupFontVars } from '@/lib/fonts'
import { createClient } from '@/lib/supabase/server'
import { listMeetings } from '@/lib/db/meetings'
import SyncGranolaButton from '@/components/os/SyncGranolaButton'

export const metadata = {
  title: 'Meetings | Trailhead OS',
}

function fmtDate(iso: string | null) {
  if (!iso) return 'No date'
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

export default async function MeetingsPage() {
  const supabase = await createClient()
  const meetings = await listMeetings(supabase).catch(() => [])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Meetings</h1>
            <p className="text-sm text-[var(--muted)]">
              Granola meeting notes, auto-linked to contacts and accounts by attendee email.
            </p>
          </div>
          <SyncGranolaButton />
        </div>

        {meetings.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-[var(--border)] px-6 py-16 text-center text-sm text-[var(--muted)]">
            No meetings synced yet. Hit “Sync now”, or wait for the hourly sync.
          </div>
        ) : (
          <div className="space-y-2">
            {meetings.map((meeting) => (
              <Link
                key={meeting.id}
                href={`/crm/meetings/${meeting.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--lime)]/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{meeting.title || 'Untitled meeting'}</p>
                  <p className="text-xs text-[var(--muted)]">{fmtDate(meeting.meeting_date)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {meeting.account ? (
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
                      {meeting.account.name}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
                    {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
