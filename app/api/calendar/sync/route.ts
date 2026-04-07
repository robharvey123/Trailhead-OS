import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { syncAllGoogleAccounts } from '@/lib/google/calendar'
import { syncAllFeeds } from '@/lib/calendar/feeds'

type SyncDirection = 'push' | 'pull' | 'both'
type SyncSource = 'google' | 'feeds' | 'all'

function isSyncDirection(value: unknown): value is SyncDirection {
  return value === 'push' || value === 'pull' || value === 'both'
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const direction = body.direction ?? 'both'
  const source: SyncSource = (body.source as SyncSource) ?? 'all'

  if (!isSyncDirection(direction)) {
    return NextResponse.json(
      { error: "direction must be 'push', 'pull', or 'both'" },
      { status: 400 }
    )
  }

  const days = Math.max(1, Number.parseInt(String(body.days ?? '30'), 10) || 30)

  try {
    const result: {
      google?: Awaited<ReturnType<typeof syncAllGoogleAccounts>>
      feeds?: Awaited<ReturnType<typeof syncAllFeeds>>
    } = {}

    // Sync Google accounts
    if (source === 'google' || source === 'all') {
      try {
        result.google = await syncAllGoogleAccounts(days)
      } catch {
        // Google sync may fail if no accounts connected — that's fine
        result.google = { accounts: [], totalPushed: 0, totalPulled: 0 }
      }
    }

    // Sync iCal feeds
    if (source === 'feeds' || source === 'all') {
      result.feeds = await syncAllFeeds()
    }

    const pushed = result.google?.totalPushed ?? 0
    const pulled =
      (result.google?.totalPulled ?? 0) +
      (result.feeds?.results.reduce((sum, r) => sum + r.upserted, 0) ?? 0)

    return NextResponse.json({
      pushed,
      pulled,
      google: result.google,
      feeds: result.feeds,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync calendar events' },
      { status: 500 }
    )
  }
}
