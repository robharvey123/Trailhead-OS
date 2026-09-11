import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getInvoiceableSummary } from '@/lib/db/timesheet'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('account_id')
    const engagementId = searchParams.get('engagement_id')

    if (!accountId && !engagementId) {
      return NextResponse.json(
        { error: 'account_id or engagement_id is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const groups = await getInvoiceableSummary(
      { account_id: accountId || undefined, engagement_id: engagementId || undefined },
      supabase
    )

    return NextResponse.json({ groups })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load unbilled time' },
      { status: 500 }
    )
  }
}
