import { NextResponse } from 'next/server'
import { runOutreachTick } from '@/lib/outreach/scheduler'

export const maxDuration = 60

/**
 * Every 15 minutes: walk each running outreach campaign, send who's due within
 * the send window and daily cap, and advance or stop each recipient. The
 * optimistic per-recipient claim inside runOutreachTick guarantees no double-send
 * even if two ticks overlap.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runOutreachTick()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Outreach tick failed' }, { status: 500 })
  }
}
