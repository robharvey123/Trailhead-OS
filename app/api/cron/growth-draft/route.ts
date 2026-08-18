import { NextResponse } from 'next/server'
import { processDraftQueue } from '@/lib/growth/drafting'

// Drafting a full article is the longest model call in the OS — give it the
// full Vercel window rather than the usual 60s.
export const maxDuration = 300

// Works the seo_articles draft queue: one article per tick.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ skipped: 'Anthropic not configured' })
  }

  try {
    const result = await processDraftQueue()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Draft queue failed' },
      { status: 500 }
    )
  }
}
