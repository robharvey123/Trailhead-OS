import { createClient } from '@/lib/supabase/server'
import { getCallQueue, getUnscreenedCallCount } from '@/lib/db/outreach'
import { mockupFontVars } from '@/lib/fonts'
import PageHeader from '@/components/ui/PageHeader'
import CtpsScreenButton from '@/components/os/CtpsScreenButton'
import { logCallOutcome } from './actions'

export const metadata = { title: 'Call queue | Trailhead OS' }

const OUTCOMES = ['no_answer', 'voicemail', 'connected', 'interested', 'not_interested', 'callback', 'bad_number', 'do_not_call']

export default async function CallQueuePage() {
  const supabase = await createClient()
  const [queue, unscreened] = await Promise.all([
    getCallQueue(supabase).catch(() => []),
    getUnscreenedCallCount(supabase).catch(() => 0),
  ])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="space-y-6">
        <PageHeader
          back={{ href: '/outreach', label: 'Outreach' }}
          title="Call queue"
          description="Delivered prospects, earliest first. Only numbers CTPS-screened clear in the last 28 days, and not unsubscribed, bounced or do-not-call, appear."
        />

        {unscreened > 0 ? (
          <div className="space-y-3 rounded-card border border-[color:var(--amber)] bg-[var(--amber-dim)] p-4 text-sm text-[color:var(--amber-strong)]">
            <p>
              ⚠ {unscreened} delivered {unscreened === 1 ? 'prospect is' : 'prospects are'} not CTPS-screened in the last 28 days and are hidden from this queue.
              Numbers are screened automatically through Data Soap every night at 04:30 UTC, or screen them now.
            </p>
            <CtpsScreenButton />
          </div>
        ) : null}

        {queue.length === 0 ? (
          <div className="empty">No callable prospects yet. Emails need to deliver first.</div>
        ) : (
          <div className="space-y-3">
            {queue.map((row) => (
              <div key={row.recipient_id} className="os-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)]">{row.company ?? row.name}</p>
                    <p className="text-xs text-[var(--text-2)]">
                      {row.name}{row.phone ? ` · ${row.phone}` : ''}{row.website ? ` · ${row.website}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-2)]">
                      {[row.sub_trade, row.size_signal].filter(Boolean).join(' · ') || 'No opening-line context'}
                    </p>
                    {row.call_status ? (
                      <p className="mt-1 text-xs text-[var(--accent-strong)]">Last outcome: {row.call_status}</p>
                    ) : null}
                  </div>
                  <form action={logCallOutcome} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="recipient_id" value={row.recipient_id} />
                    <input type="hidden" name="contact_id" value={row.contact_id} />
                    <select name="outcome" className="filter-select" defaultValue="">
                      <option value="" disabled>Outcome…</option>
                      {OUTCOMES.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                    </select>
                    <input name="notes" placeholder="Notes" className="os-input min-w-40 px-2.5 py-[7px] text-xs" />
                    <button className="btn btn-primary btn-sm">Log</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
