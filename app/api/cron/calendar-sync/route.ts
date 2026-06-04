import { NextResponse } from 'next/server'
import { syncAllGoogleAccounts } from '@/lib/google/calendar'
import { syncAllMicrosoftAccounts } from '@/lib/microsoft/calendar'
import { syncAllFeeds } from '@/lib/calendar/feeds'
import { supabaseService } from '@/lib/supabase/service'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')

  // Enforce the cron secret when it's configured (Vercel sends it automatically);
  // tolerate its absence so the sync still runs if the env var isn't set yet.
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Look up the single user's ID for RLS-compatible inserts
  const { data: users } = await supabaseService.auth.admin.listUsers({ perPage: 1 })
  const userId = users?.users?.[0]?.id

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
