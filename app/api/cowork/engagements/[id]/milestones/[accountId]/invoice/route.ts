import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { getEngagementRow, raiseMilestoneInvoiceByAccount } from '@/lib/cowork-engagements'
import { recordCoworkWrite } from '@/lib/cowork-audit'

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
    const engagement = await getEngagementRow(id)
    const invoice = await raiseMilestoneInvoiceByAccount(id, accountId)
    const fee = invoice.line_items?.[0]?.unit_price ?? 0
    void recordCoworkWrite({
      action: 'create',
      entity: 'invoice',
      entityId: invoice.id,
      entityLabel: invoice.invoice_number,
      engagementId: engagement.id,
      summary: `Raised ${invoice.invoice_number}, £${Number(fee).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Tier 1 listing fee, ${engagement.name}`,
      payload: { engagement_id: engagement.id, account_id: accountId, fee },
    })
    return Response.json({ invoice }, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to raise invoice')
  }
}
