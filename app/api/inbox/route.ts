import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { listThreads, type InboxFolder } from '@/lib/db/inbox'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const url = new URL(request.url)
    const threads = await listThreads(
      {
        folder: (url.searchParams.get('folder') as InboxFolder) || 'all',
        accountId: url.searchParams.get('account_id') || undefined,
        search: url.searchParams.get('search') || undefined,
      },
      supabase
    )
    return NextResponse.json({ threads })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load inbox'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
