import { NextResponse } from 'next/server'
import { syncGranolaMeetings } from '@/lib/granola-sync'

export const maxDuration = 60

/**
 * Hourly cron: pull new/updated Granola notes into `meetings` and link them to
 * CRM contacts/accounts by attendee email. Same shared sync logic as the
 * "Sync now" button on the Meetings page.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncGranolaMeetings()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Granola sync failed' },
      { status: 500 }
    )
  }
}
