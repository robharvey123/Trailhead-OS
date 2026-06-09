import CalendarIntegrationsClient from '@/components/os/CalendarIntegrationsClient'
import CalendarSubscriptionSection from '@/components/os/CalendarSubscriptionSection'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export default async function CalendarIntegrationsPage() {
  const supabase = await createClient()

  const [workstreams, googleAccounts, microsoftAccounts, feeds] = await Promise.all([
    getWorkstreams(supabase).catch(() => []),
    (async () => {
      const { data } = await supabase
        .from('google_tokens')
        .select('id, email, label, created_at, needs_reconnect')
        .order('created_at')
      return data ?? []
    })(),
    (async () => {
      const { data } = await supabase
        .from('microsoft_tokens')
        .select('id, email, label, created_at')
        .order('created_at')
      return data ?? []
    })(),
    (async () => {
      const { data } = await supabase
        .from('calendar_feeds')
        .select('*')
        .order('created_at')
      return data ?? []
    })(),
  ])

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trailheadholdings.uk'
  ).replace(/\/$/, '')
  const icalSecret = process.env.ICAL_SECRET ?? ''

  return (
    <div className="space-y-8">
      <div>
        <p className="os-eyebrow">
          Calendar
        </p>
        <h1 className="os-page-title mt-2">
          Calendar Integrations
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--text-2)]">
          Connect your Google, Apple, and Outlook calendars to see everything in
          one place.
        </p>
      </div>

      <CalendarIntegrationsClient
        googleAccounts={googleAccounts}
        microsoftAccounts={microsoftAccounts}
        feeds={feeds}
      />

      {icalSecret && (
        <CalendarSubscriptionSection
          appUrl={appUrl}
          icalSecret={icalSecret}
          workstreams={workstreams}
        />
      )}
    </div>
  )
}
