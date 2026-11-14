import Link from 'next/link'
import { mockupFontVars } from '@/lib/fonts'
import { createClient } from '@/lib/supabase/server'
import { listMeetings } from '@/lib/db/meetings'
import SyncGranolaButton from '@/components/os/SyncGranolaButton'
import PageHeader from '@/components/ui/PageHeader'

export const metadata = {
  title: 'Meetings',
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
      <div className="space-y-6">
        <PageHeader
          title="Meetings"
          description="Granola meeting notes, auto-linked to contacts and accounts by attendee email."
          actions={<SyncGranolaButton />}
        />

        {meetings.length === 0 ? (
          <div className="rounded-card border border-dashed border-[var(--border)] px-6 py-16 text-center text-sm text-[var(--text-2)]">
            No meetings synced yet. Hit “Sync now”, or wait for the hourly sync.
          </div>
        ) : (
          <div className="space-y-2">
            {meetings.map((meeting) => (
              <Link
                key={meeting.id}
                href={`/crm/meetings/${meeting.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-[var(--border)] bg-[var(--bg)] p-4 shadow-[var(--shadow-sm)] transition hover:border-[var(--border-light)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text)]">{meeting.title || 'Untitled meeting'}</p>
                  <p className="text-xs text-[var(--text-3)]">{fmtDate(meeting.meeting_date)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {meeting.account ? (
                    <span className="tag-chip">
                      {meeting.account.name}
                    </span>
                  ) : null}
                  <span className="tag-chip">
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
