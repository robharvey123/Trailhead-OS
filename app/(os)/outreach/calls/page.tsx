import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCallQueue, getUnscreenedCallCount } from '@/lib/db/outreach'
import { mockupFontVars } from '@/lib/fonts'
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
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <div>
          <Link href="/outreach" className="text-sm text-[var(--muted)] hover:text-white">← Outreach</Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">Call queue</h1>
          <p className="text-sm text-[var(--muted)]">
            Delivered prospects, earliest first. Only CTPS-screened, non-registered, callable numbers appear.
          </p>
        </div>

        {unscreened > 0 ? (
          <div className="rounded-2xl border border-[color:var(--amber)] bg-[var(--amber-dim)] p-4 text-sm text-[color:var(--amber-strong)]">
            ⚠ {unscreened} delivered {unscreened === 1 ? 'prospect is' : 'prospects are'} not yet CTPS-screened and are hidden from this queue.
            Screen the numbers and set <code>ctps_checked_at</code> (and <code>ctps_registered</code>) before calling them.
          </div>
        ) : null}

        {queue.length === 0 ? (
          <div className="empty">No callable prospects yet. Emails need to deliver first.</div>
        ) : (
          <div className="space-y-3">
            {queue.map((row) => (
              <div key={row.recipient_id} className="os-card rounded-[1.5rem] p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{row.company ?? row.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {row.name}{row.phone ? ` · ${row.phone}` : ''}{row.website ? ` · ${row.website}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {[row.sub_trade, row.size_signal].filter(Boolean).join(' · ') || 'No opening-line context'}
                    </p>
                    {row.call_status ? (
                      <p className="mt-1 text-xs text-[var(--lime)]">Last outcome: {row.call_status}</p>
                    ) : null}
                  </div>
                  <form action={logCallOutcome} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="recipient_id" value={row.recipient_id} />
                    <input type="hidden" name="contact_id" value={row.contact_id} />
                    <select name="outcome" className="filter-select" defaultValue="">
                      <option value="" disabled>Outcome…</option>
                      {OUTCOMES.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                    </select>
                    <input name="notes" placeholder="Notes" className="filter-select" style={{ minWidth: 160 }} />
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
