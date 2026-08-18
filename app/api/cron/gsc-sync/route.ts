import { NextResponse } from 'next/server'
import { syncAllGscSites } from '@/lib/growth/gsc'

export const maxDuration = 60

// Daily Search Console pull for every Growth site with a gsc_property.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncAllGscSites()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'GSC sync failed' },
      { status: 500 }
    )
  }
}
