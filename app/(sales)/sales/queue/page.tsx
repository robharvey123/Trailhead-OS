import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, roleIsSales } from '@/lib/auth/roles'
import { getSalesQueue } from '@/lib/sales/queue'
import QueueClient from './QueueClient'

export const metadata = { title: 'Call queue | Sales | Trailhead OS' }

export default async function SalesQueuePage() {
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase).catch(() => null)
  // The seat sees its own and unclaimed contacts; owner/admin see everything.
  const rows = await getSalesQueue(supabase, { forUserId: roleIsSales(profile?.role) ? profile?.id : null })
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today&apos;s queue</h1>
        <p className="mt-1 text-sm text-[color:var(--text-2)]">
          Callbacks first, then warm follow-ups, trials, and fresh numbers. Only CTPS-clear numbers (screened in the last 28 days) appear.
        </p>
      </div>
      <QueueClient initialRows={rows} />
    </div>
  )
}
