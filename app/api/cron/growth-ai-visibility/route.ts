import { NextResponse } from 'next/server'
import { runVisibilityChecks } from '@/lib/growth/visibility'

// prompts × providers × sites is the slowest job in the module — full window.
export const maxDuration = 300

// Weekly AI-visibility sweep: each active prompt against each configured
// provider, scored and stored in seo_ai_mentions.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runVisibilityChecks()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI visibility run failed' },
      { status: 500 }
    )
  }
}
