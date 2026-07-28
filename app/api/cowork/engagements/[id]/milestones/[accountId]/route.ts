import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { setMilestone } from '@/lib/cowork-engagements'

// PATCH — set or clear gates, set performance_fee, attach fee_invoice_id for one
// tier-1 account. Body is either { "gate": "first_po_received", "date": "..." } or
// the columns directly (range_review_decided_at, performance_fee, fee_invoice_id, ...).
// Passing a null date/gate clears it. is_complete/completed_at are stamped by the DB
// trigger, never written here.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; accountId: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { id, accountId } = await params
    const body = await request.json().catch(() => ({}))
    return Response.json(await setMilestone(id, accountId, body))
  } catch (error) {
    return jsonError(error, 'Failed to update milestone')
  }
}
