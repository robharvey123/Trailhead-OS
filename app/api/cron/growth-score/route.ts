import { NextResponse } from 'next/server'
import { runGrowthScores } from '@/lib/growth/score'

export const maxDuration = 60

// Nightly Growth Score per site (runs after gsc-sync so it scores fresh data).
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runGrowthScores()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Growth score run failed' },
      { status: 500 }
    )
  }
}
