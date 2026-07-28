import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { raiseMilestoneInvoiceByAccount } from '@/lib/cowork-engagements'

// POST — raise the performance-fee invoice for a completed milestone. Creates the
// invoice at the milestone's performance_fee, stamps engagement_id and the
// milestone's fee_invoice_id, and returns the invoice.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { id, accountId } = await params
    const invoice = await raiseMilestoneInvoiceByAccount(id, accountId)
    return Response.json({ invoice }, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to raise invoice')
  }
}
