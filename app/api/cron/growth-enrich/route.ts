import { NextResponse } from 'next/server'
import { enrichAllSites } from '@/lib/growth/enrich'

export const maxDuration = 300

// Daily 05:30 (after gsc-sync): DataForSEO Labs keyword difficulty, search
// intent and monthly volume history for every keyword not enriched in 30 days.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json(await enrichAllSites())
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Enrichment failed' }, { status: 500 })
  }
}
