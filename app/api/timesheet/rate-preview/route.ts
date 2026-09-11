import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { resolveTimeLinks, TimeLinkConflict } from '@/lib/time/links'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/timesheet/rate-preview?engagement_id=&project_id=&task_id=&account_id=&person_id=
// → the rate the server will snapshot for those links, and where it came from.
// Session client on purpose: contributor rates are an authenticated read.
export async function GET(request: NextRequest) {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response
    const sp = request.nextUrl.searchParams
    const links = await resolveTimeLinks(
      {
        engagement_id: sp.get('engagement_id') || null,
        project_id: sp.get('project_id') || null,
        task_id: sp.get('task_id') || null,
        account_id: sp.get('account_id') || null,
        person_id: sp.get('person_id') || null,
      },
      supabase as unknown as SupabaseClient
    )
    return NextResponse.json({
      rate_snapshot: links.rate_snapshot,
      rate_source: links.rate_source,
      billable: links.billable,
      engagement_id: links.engagement_id,
      project_id: links.project_id,
      account_id: links.account_id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to preview rate'
    const status = error instanceof TimeLinkConflict ? 409 : /not found/i.test(message) ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
