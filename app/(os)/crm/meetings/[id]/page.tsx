import Link from 'next/link'
import { notFound } from 'next/navigation'
import { mockupFontVars } from '@/lib/fonts'
import { createClient } from '@/lib/supabase/server'
import { getMeeting } from '@/lib/db/meetings'
import MeetingSummary from '@/components/os/MeetingSummary'
import MeetingLinksEditor, { type LinkItem } from '@/components/os/MeetingLinksEditor'
import PageHeader from '@/components/ui/PageHeader'

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
    supabase.from('accounts').select('id, name').eq('record_type', 'sales').order('name'),
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
      <div className="os-narrow space-y-6">
        <PageHeader
          back={{ href: '/crm/meetings', label: 'Meetings' }}
          title={meeting.title || 'Untitled meeting'}
          description={fmtDate(meeting.meeting_date)}
        />

        {meeting.attendees.length > 0 ? (
          <div className="os-card p-6">
            <h2 className="os-label">Attendees</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {meeting.attendees.map((attendee, i) => {
                const matched = contactByEmail.get(attendee.email.trim().toLowerCase())
                const label = attendee.name || attendee.email
                return matched ? (
                  <Link
                    key={`${attendee.email}-${i}`}
                    href={`/crm/contacts/${matched.id}`}
                    className="rounded-pill border border-[var(--accent)] bg-[var(--accent-dim)] px-3 py-1 text-xs font-medium text-[var(--accent-strong)] transition hover:bg-[var(--bg)]"
                  >
                    {label}
                  </Link>
                ) : (
                  <span
                    key={`${attendee.email}-${i}`}
                    className="rounded-pill border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--text-2)]"
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

        <div className="os-card p-6">
          <h2 className="os-label">Summary</h2>
          <div className="mt-3">
            <MeetingSummary markdown={meeting.summary_md} />
          </div>
        </div>
      </div>
    </div>
  )
}
