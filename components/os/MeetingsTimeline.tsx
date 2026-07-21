import Link from 'next/link'
import type { MeetingWithRelations } from '@/lib/db/meetings'

// Server component: a simple list of Granola meetings for account/contact detail
// pages — date + title, linking to the meeting page. Full summary lives there.

function fmtDate(iso: string | null) {
  if (!iso) return 'No date'
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function MeetingsTimeline({ meetings }: { meetings: MeetingWithRelations[] }) {
  return (
    <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Meetings</h2>
        <p className="text-sm text-[var(--muted)]">Granola meeting notes matched by attendee email.</p>
      </div>

      {meetings.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
          No meetings yet. They appear here after a Granola sync matches an attendee.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {meetings.map((meeting) => (
            <Link
              key={meeting.id}
              href={`/crm/meetings/${meeting.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[var(--border)] bg-[var(--card-alt)] p-4 transition hover:border-[var(--lime)]/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{meeting.title || 'Untitled meeting'}</p>
                <p className="text-xs text-[var(--muted)]">{fmtDate(meeting.meeting_date)}</p>
              </div>
              <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
                {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
