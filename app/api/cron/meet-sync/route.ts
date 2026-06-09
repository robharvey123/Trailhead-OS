import { NextResponse } from 'next/server'
import { syncMeetings } from '@/lib/google/meet-sync'

export const maxDuration = 60

// Polling trigger — ingests transcripts + Gemini summaries for recently-ended Meets.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncMeetings({ sinceHours: 6 })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Meet sync failed' },
      { status: 500 }
    )
  }
}
