import { NextResponse } from 'next/server'
import { generateEngineTasks } from '@/lib/growth/task-generation'

export const maxDuration = 60

// Nightly engine → task generation (follow-ups, quick wins, backlink mining,
// fact-checks, monthly report reviews). All rules idempotent.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await generateEngineTasks()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Task generation failed' },
      { status: 500 }
    )
  }
}
