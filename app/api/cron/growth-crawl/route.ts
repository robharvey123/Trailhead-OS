import { NextResponse } from 'next/server'
import { runCrawls } from '@/lib/growth/onpage'

export const maxDuration = 300

// Every 6 hours: start monthly OnPage crawls and collect any that have
// finished (the crawl itself runs on DataForSEO's side).
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json(await runCrawls())
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Crawl failed' }, { status: 500 })
  }
}
