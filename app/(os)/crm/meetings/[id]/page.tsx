import Link from 'next/link'
import { notFound } from 'next/navigation'
import { mockupFontVars } from '@/lib/fonts'
import { createClient } from '@/lib/supabase/server'
import { getMeeting } from '@/lib/db/meetings'
import MeetingSummary from '@/components/os/MeetingSummary'

function fmtDate(iso: string | null) {
  if (!iso) return 'No date'
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })
}

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const meeting = await getMeeting(id, supabase).catch(() => null)

  if (!meeting) {
    notFound()
  }

  // Resolve the linked contacts so matched attendees can link to their page.
  const contactByEmail = new Map<string, { id: string; name: string }>()
  if (meeting.contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email')
      .in('id', meeting.contactIds)
    for (const c of (contacts ?? []) as Array<{ id: string; name: string; email: string | null }>) {
      if (c.email) contactByEmail.set(c.email.trim().toLowerCase(), { id: c.id, name: c.name })
    }
  }

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div>
          <Link href="/crm/meetings" className="text-sm text-[var(--muted)] transition hover:text-white">
            ← Meetings
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">{meeting.title || 'Untitled meeting'}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{fmtDate(meeting.meeting_date)}</p>
          {meeting.account ? (
            <Link
              href={`/crm/accounts/${meeting.account.id}`}
              className="mt-3 inline-block rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] transition hover:border-[var(--lime)]/40"
            >
              {meeting.account.name}
            </Link>
          ) : null}
        </div>

        {meeting.attendees.length > 0 ? (
          <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Attendees</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {meeting.attendees.map((attendee, i) => {
                const matched = contactByEmail.get(attendee.email.trim().toLowerCase())
                const label = attendee.name || attendee.email
                return matched ? (
                  <Link
                    key={`${attendee.email}-${i}`}
                    href={`/crm/contacts/${matched.id}`}
                    className="rounded-full border border-[var(--lime)]/40 px-3 py-1 text-xs text-[var(--lime)] transition hover:border-[var(--lime)]"
                  >
                    {label}
                  </Link>
                ) : (
                  <span
                    key={`${attendee.email}-${i}`}
                    className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]"
                  >
                    {label}
                  </span>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Summary</h2>
          <div className="mt-3">
            <MeetingSummary markdown={meeting.summary_md} />
          </div>
        </div>
      </div>
    </div>
  )
}
