import { NextResponse } from 'next/server'
import { collectReadyResults } from '@/lib/growth/keywords'

export const maxDuration = 60

// Drains completed DataForSEO tasks (keyword ideas + SERPs) into seo_keywords /
// seo_serp_snapshots, working the seo_dfs_tasks ledger. No-op when nothing is
// queued. The result is logged and a partial failure returns 500 on purpose:
// this route previously returned 200 with its errors buried in the body, which
// is how a collect bug went unnoticed for a day.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.DATAFORSEO_LOGIN) {
    console.warn('[growth-collect] skipped — DATAFORSEO_LOGIN is not set')
    return NextResponse.json({ skipped: 'DataForSEO not configured' })
  }

  try {
    const result = await collectReadyResults()
    console.log('[growth-collect]', JSON.stringify(result))
    if (result.errors.length > 0) {
      return NextResponse.json(result, { status: 500 })
    }
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Growth collect failed'
    console.error('[growth-collect] failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
