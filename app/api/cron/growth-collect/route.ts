import { NextResponse } from 'next/server'
import { collectReadyResults } from '@/lib/growth/keywords'

export const maxDuration = 60

// Drains completed DataForSEO Standard-queue tasks (keyword ideas + SERPs)
// into seo_keywords / seo_serp_snapshots. No-op when nothing is queued.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.DATAFORSEO_LOGIN) {
    return NextResponse.json({ skipped: 'DataForSEO not configured' })
  }

  try {
    const result = await collectReadyResults()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Growth collect failed' },
      { status: 500 }
    )
  }
}
