import { createClient } from '@/lib/supabase/server'
import { getUnscreenedCallCount } from '@/lib/db/outreach'
import { getSalesQueue } from '@/lib/sales/queue'
import { mockupFontVars } from '@/lib/fonts'
import PageHeader from '@/components/ui/PageHeader'
import CtpsScreenButton from '@/components/os/CtpsScreenButton'
import QueueClient from '@/components/sales/QueueClient'

export const metadata = { title: 'Call queue' }

// One queue for Rob and Francesca: the same list, order and outcome logger as
// /sales/queue. Owner sees every in-scope contact, including ones the sales seat
// has claimed (labelled), so nobody rings a contact the other is working.
export default async function CallQueuePage() {
  const supabase = await createClient()
  const [rows, unscreened, { data: profiles }] = await Promise.all([
    getSalesQueue(supabase, { forUserId: null }).catch(() => []),
    getUnscreenedCallCount(supabase).catch(() => 0),
    supabase.from('profiles').select('id, display_name'),
  ])
  const ownerNames = Object.fromEntries(
    ((profiles ?? []) as Array<{ id: string; display_name: string | null }>)
      .filter((p) => p.display_name)
      .map((p) => [p.id, p.display_name as string])
  )

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="space-y-6">
        <PageHeader
          back={{ href: '/outreach', label: 'Outreach' }}
          title="Today's call queue"
          description="Shared with the sales seat. Callbacks first, then warm follow-ups, trials, and fresh numbers. Only CTPS-clear numbers (screened in the last 28 days) appear."
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

        <QueueClient initialRows={rows} contactBasePath="/crm/contacts" ownerNames={ownerNames} />
      </div>
    </div>
  )
}
