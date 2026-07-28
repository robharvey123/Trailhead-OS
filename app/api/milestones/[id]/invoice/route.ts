import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { raiseMilestoneInvoice } from '@/lib/cowork-engagements'
import { CoworkApiError } from '@/lib/cowork-api'
import { NextRequest, NextResponse } from 'next/server'

// POST — raise the performance-fee invoice for a completed milestone. The logic
// (recipient = billed_via, falling back to end client; stamp engagement_id and the
// milestone's fee_invoice_id) lives in raiseMilestoneInvoice so the Cowork API and
// this UI route stay in lockstep.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params

    const invoice = await raiseMilestoneInvoice(id, supabase)
    return NextResponse.json({ invoice }, { status: 201 })
  } catch (error) {
    if (error instanceof CoworkApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to raise invoice' }, { status: 500 })
  }
}
