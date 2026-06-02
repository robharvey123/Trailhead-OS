import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { decideApproval, withdrawApproval } from '@/lib/db/approvals'
import { NextRequest, NextResponse } from 'next/server'

// PATCH { action: 'approve' | 'decline' | 'withdraw', notes? }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params
    const body = await request.json()
    let approval
    if (body.action === 'approve') approval = await decideApproval(id, 'Approved', body.notes ?? null, supabase)
    else if (body.action === 'decline') approval = await decideApproval(id, 'Declined', body.notes ?? null, supabase)
    else if (body.action === 'withdraw') approval = await withdrawApproval(id, supabase)
    else return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    return NextResponse.json({ approval })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update approval' }, { status: 500 })
  }
}
