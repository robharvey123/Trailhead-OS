import { NextResponse } from 'next/server'
import { syncAllGoogleAccounts } from '@/lib/google/calendar'
import { syncAllMicrosoftAccounts } from '@/lib/microsoft/calendar'
import { syncAllFeeds } from '@/lib/calendar/feeds'
import { supabaseService } from '@/lib/supabase/service'
import { getOwnerUserId } from '@/lib/auth/owner'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // The OS owner's ID for RLS-compatible inserts
  const userId = await getOwnerUserId(supabaseService)

  if (!userId) {
    return NextResponse.json({ error: 'No user found' }, { status: 500 })
  }

  try {
    const [google, microsoft, feeds] = await Promise.all([
      syncAllGoogleAccounts(60, userId).catch((err) => ({
        accounts: [],
        totalPushed: 0,
        totalPulled: 0,
        error: err instanceof Error ? err.message : 'Google sync failed',
      })),
      syncAllMicrosoftAccounts(60, userId).catch((err) => ({
        accounts: [],
        totalPushed: 0,
        totalPulled: 0,
        error: err instanceof Error ? err.message : 'Microsoft sync failed',
      })),
      syncAllFeeds(userId).catch((err) => ({
        results: [],
        error: err instanceof Error ? err.message : 'Feed sync failed',
      })),
    ])

    const pulled =
      ('totalPulled' in google ? google.totalPulled : 0) +
      ('totalPulled' in microsoft ? microsoft.totalPulled : 0) +
      ('results' in feeds ? feeds.results.reduce((sum, r) => sum + r.upserted, 0) : 0)

    return NextResponse.json({
      ok: true,
      pulled,
      google,
      microsoft,
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
