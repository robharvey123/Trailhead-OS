import { NextResponse } from 'next/server'
import { syncAllGoogleAccounts } from '@/lib/google/calendar'
import { syncAllFeeds } from '@/lib/calendar/feeds'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [google, feeds] = await Promise.all([
      syncAllGoogleAccounts(60).catch((err) => ({
        accounts: [],
        totalPushed: 0,
        totalPulled: 0,
        error: err instanceof Error ? err.message : 'Google sync failed',
      })),
      syncAllFeeds().catch((err) => ({
        results: [],
        error: err instanceof Error ? err.message : 'Feed sync failed',
      })),
    ])

    const pulled =
      ('totalPulled' in google ? google.totalPulled : 0) +
      ('results' in feeds ? feeds.results.reduce((sum, r) => sum + r.upserted, 0) : 0)

    return NextResponse.json({
      ok: true,
      pulled,
      google,
      feeds,
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
