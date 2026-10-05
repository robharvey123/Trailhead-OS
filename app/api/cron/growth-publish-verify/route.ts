import { NextResponse } from 'next/server'
import { verifyPublishingArticles } from '@/lib/growth/publish'

// Each article is a PR lookup plus a URL probe; 25 per tick fits comfortably.
export const maxDuration = 60

/**
 * Promotes articles out of 'publishing' once their PR has merged AND their URL
 * returns 200 — the only thing that sets status 'published' for a GitHub site.
 * Also records a failed preview build on the article so a blocked publish is
 * visible without opening GitHub.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await verifyPublishingArticles()
    return NextResponse.json({
      checked: results.length,
      published: results.filter((r) => r.outcome === 'published').length,
      blocked: results.filter((r) => r.outcome === 'blocked').length,
      gave_up: results.filter((r) => r.outcome === 'gave_up').length,
      results,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Publish verification failed' },
      { status: 500 }
    )
  }
}
