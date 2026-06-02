import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { updateMilestone } from '@/lib/db/tier1'
import { NextRequest, NextResponse } from 'next/server'

// PATCH { range_review_decided_at?, go_live_confirmed_at?, first_po_received_at?, performance_fee?, notes? }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params
    const body = await request.json()
    const patch: Record<string, unknown> = {}
    for (const f of ['range_review_decided_at', 'go_live_confirmed_at', 'first_po_received_at', 'performance_fee', 'notes']) {
      if (f in body) patch[f] = body[f] === '' ? null : body[f]
    }
    const milestone = await updateMilestone(id, patch, supabase)
    return NextResponse.json({ milestone })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update milestone' }, { status: 500 })
  }
}
