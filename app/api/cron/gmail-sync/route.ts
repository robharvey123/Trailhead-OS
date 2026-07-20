import { NextResponse } from 'next/server'
import { syncMailbox } from '@/lib/google/gmail-sync'

export const maxDuration = 60

// Polling fallback — ingests recent INBOX + SENT into email_logs.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncMailbox({ sinceDays: 1, notify: true })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gmail sync failed' },
      { status: 500 }
    )
  }
}
