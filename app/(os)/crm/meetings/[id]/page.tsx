import Link from 'next/link'
import { notFound } from 'next/navigation'
import { mockupFontVars } from '@/lib/fonts'
import { createClient } from '@/lib/supabase/server'
import { getMeeting } from '@/lib/db/meetings'
import MeetingSummary from '@/components/os/MeetingSummary'
import MeetingLinksEditor, { type LinkItem } from '@/components/os/MeetingLinksEditor'

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

  // For the picker + attendee cross-linking: all accounts, all contacts, and the
  // subset currently linked to this meeting.
  const [{ data: allAccountRows }, { data: allContactRows }, { data: linkedContactRows }] = await Promise.all([
    supabase.from('accounts').select('id, name').order('name'),
    supabase.from('contacts').select('id, name, email, company').order('name'),
    meeting.contactIds.length > 0
      ? supabase.from('contacts').select('id, name, email').in('id', meeting.contactIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; email: string | null }> }),
  ])

  const allAccounts: LinkItem[] = (allAccountRows ?? []).map((a) => ({ id: a.id, name: a.name }))
  const allContacts: LinkItem[] = (allContactRows ?? []).map((c) => ({
    id: c.id, name: c.name, sub: c.email ?? c.company ?? null,
  }))
  const linkedContacts: LinkItem[] = (linkedContactRows ?? []).map((c) => ({ id: c.id, name: c.name, sub: c.email ?? null }))

  // Resolve the linked contacts so matched attendees can link to their page.
  const contactByEmail = new Map<string, { id: string; name: string }>()
  for (const c of (linkedContactRows ?? []) as Array<{ id: string; name: string; email: string | null }>) {
    if (c.email) contactByEmail.set(c.email.trim().toLowerCase(), { id: c.id, name: c.name })
  }

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div>
          <Link href="/crm/meetings" className="text-sm text-[var(--muted)] transition hover:text-[color:var(--text)]">
            ← Meetings
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-[color:var(--text)]">{meeting.title || 'Untitled meeting'}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{fmtDate(meeting.meeting_date)}</p>
        </div>

        {meeting.attendees.length > 0 ? (
          <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text)]">Attendees</h2>
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

        <MeetingLinksEditor
          meetingId={meeting.id}
          initialAccounts={meeting.accounts}
          initialContacts={linkedContacts}
          allAccounts={allAccounts}
          allContacts={allContacts}
        />

        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text)]">Summary</h2>
          <div className="mt-3">
            <MeetingSummary markdown={meeting.summary_md} />
          </div>
        </div>
      </div>
    </div>
  )
}
