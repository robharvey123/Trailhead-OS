import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSalesContactRecord } from '@/lib/sales/data'
import EligibilityBadge from '@/components/sales/EligibilityBadge'
import ContactActions from './ContactActions'
import PipelinePanel from './PipelinePanel'
import FollowUpEmail from './FollowUpEmail'
import { OUTCOME_LABELS, type OutcomeCode, type PipelineStage } from '@/lib/sales/queue'

export const metadata = { title: 'Contact | Sales | Trailhead OS' }

function fmt(v: string | null) {
  return v ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
}

export default async function SalesContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [record, { data: { user } }] = await Promise.all([getSalesContactRecord(supabase, id), supabase.auth.getUser()])
  if (!record) notFound()
  const { contact: c, campaigns, touchpoints, followUps } = record
  const unsubscribed = Boolean(c.do_not_email) || c.eligibility?.reason === 'unsubscribed'

  return (
    <div className="space-y-6">
      <div>
        <Link href="/sales/contacts" className="text-sm text-[color:var(--text-2)] hover:underline">← Contacts</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{c.company ?? c.name}</h1>
          <EligibilityBadge eligibility={c.eligibility} />
        </div>
        <p className="mt-1 text-sm text-[color:var(--text-2)]">
          {[c.name, c.role, c.sub_trade, c.city].filter(Boolean).join(' · ')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <section className="panel p-4">
          <h2 className="text-sm font-semibold">Details</h2>
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-[color:var(--text-3)]">Phone</dt>
            <dd>{c.phone && c.eligibility?.eligible ? <a href={`tel:${c.phone.replace(/\s+/g, '')}`} className="hover:underline">{c.phone}</a> : c.phone ?? ''}</dd>
            <dt className="text-[color:var(--text-3)]">Email</dt><dd className="break-all">{c.email ?? ''}</dd>
            <dt className="text-[color:var(--text-3)]">Website</dt><dd className="break-all">{c.website ?? ''}</dd>
            <dt className="text-[color:var(--text-3)]">Size signal</dt><dd>{c.size_signal ?? ''}</dd>
            <dt className="text-[color:var(--text-3)]">CTPS</dt>
            <dd>{c.eligibility?.ctps_checked_at ? `Screened ${fmt(c.eligibility.ctps_checked_at)}` : 'Not screened'}</dd>
            <dt className="text-[color:var(--text-3)]">Tags</dt><dd>{(c.tags ?? []).join(', ')}</dd>
          </dl>
          {c.notes ? <p className="mt-4 whitespace-pre-wrap text-sm text-[color:var(--text-2)]">{c.notes}</p> : null}
        </section>

        <section className="panel p-4">
          <h2 className="text-sm font-semibold">Campaign history</h2>
          {campaigns.length === 0 ? (
            <p className="mt-3 text-sm text-[color:var(--text-3)]">Not in a campaign.</p>
          ) : (
            campaigns.map((camp) => (
              <div key={camp.recipient_id} className="mt-3">
                <p className="text-sm font-medium">
                  {camp.campaign_name}{' '}
                  <span className="text-xs font-normal text-[color:var(--text-3)]">
                    {camp.status}{camp.stopped_reason ? ` (${camp.stopped_reason})` : ''}
                  </span>
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {camp.sends.map((s) => (
                    <li key={s.id} className="flex flex-wrap justify-between gap-2">
                      <span className="min-w-0 truncate">{s.subject ?? 'Email'}</span>
                      <span className="text-xs text-[color:var(--text-3)]">
                        {s.first_opened_at ? `Opened ${fmt(s.first_opened_at)}` : s.delivered_at ? `Delivered ${fmt(s.delivered_at)}` : s.status}
                        {s.first_clicked_at ? ' · clicked' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
          {followUps.length > 0 ? (
            <div className="mt-4 border-t border-[var(--border)] pt-3">
              <p className="text-sm font-medium">Follow-ups</p>
              <ul className="mt-2 space-y-1 text-sm">
                {followUps.map((f) => (
                  <li key={f.id} className="flex flex-wrap justify-between gap-2">
                    <span className="min-w-0 truncate">{f.subject}</span>
                    <span className="text-xs text-[color:var(--text-3)]">{f.first_opened_at ? `Opened ${fmt(f.first_opened_at)}` : `${f.status} ${fmt(f.sent_at)}`}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>

      <section className="panel p-4" aria-label="Pipeline">
        <PipelinePanel
          contactId={c.id}
          stage={c.pipeline_stage as PipelineStage}
          ownerIsMe={Boolean(user && c.owner_user_id === user.id)}
          ownedByOther={Boolean(c.owner_user_id && user && c.owner_user_id !== user.id)}
          nextActionAt={c.next_action_at}
          nextActionNote={c.next_action_note}
          lostReason={c.lost_reason}
          disqualifiedReason={c.disqualified_reason}
          recontactAfter={c.recontact_after}
          orgId={c.engineer_os_org_id}
        />
      </section>

      <section className="panel p-4" aria-label="Follow-up email">
        <FollowUpEmail contactId={c.id} contactEmail={c.email} blocked={unsubscribed || c.eligibility?.reason === 'bounced'} />
      </section>

      <section className="panel p-4">
        <ContactActions contactId={c.id} unsubscribed={unsubscribed} />
      </section>

      <section className="panel p-4">
        <h2 className="text-sm font-semibold">Timeline</h2>
        {touchpoints.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--text-3)]">Nothing logged yet.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {touchpoints.map((t) => (
              <li key={t.id} className="text-sm">
                <p className="font-medium">
                  {t.outcome_code ? `${t.outcome_code} · ${OUTCOME_LABELS[t.outcome_code as OutcomeCode] ?? t.subject}` : t.subject}{' '}
                  <span className="text-xs font-normal text-[color:var(--text-3)]">{t.type} · {fmt(t.occurred_at)}{t.duration_seconds ? ` · ${Math.round(t.duration_seconds / 60)} min` : ''}</span>
                </p>
                {t.body ? <p className="mt-0.5 whitespace-pre-wrap text-[color:var(--text-2)]">{t.body}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
