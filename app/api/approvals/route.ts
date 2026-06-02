import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { createApproval, listApprovals } from '@/lib/db/approvals'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const engagementId = new URL(request.url).searchParams.get('engagement_id')
    if (!engagementId) return NextResponse.json({ error: 'engagement_id required' }, { status: 400 })
    const approvals = await listApprovals(engagementId, supabase)
    return NextResponse.json({ approvals })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load approvals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const body = await request.json()
    if (!body.engagement_id || !body.type) {
      return NextResponse.json({ error: 'engagement_id and type are required' }, { status: 400 })
    }
    const approval = await createApproval(body, supabase)
    return NextResponse.json({ approval }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create approval' }, { status: 500 })
  }
}
