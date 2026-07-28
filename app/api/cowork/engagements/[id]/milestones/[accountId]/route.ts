import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { getEngagementRow, getMilestones, setMilestone } from '@/lib/cowork-engagements'
import { recordCoworkWrite } from '@/lib/cowork-audit'

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

    // Capture prior gate state so the change can be reverted from the activity log.
    const engagement = await getEngagementRow(id)
    const prior = (await getMilestones(id)).find((m) => m.account_id === accountId)
    const milestone = await setMilestone(id, accountId, body)

    void recordCoworkWrite({
      action: 'update',
      entity: 'tier1_milestone',
      entityId: milestone.id,
      entityLabel: `${milestone.account?.name ?? 'account'} — Tier 1`,
      engagementId: engagement.id,
      summary: `Updated Tier 1 milestone for ${milestone.account?.name ?? 'an account'} on ${engagement.name}${milestone.is_complete ? ' — all three gates now complete' : ''}`,
      before: {
        range_review_decided_at: prior?.range_review_decided_at ?? null,
        go_live_confirmed_at: prior?.go_live_confirmed_at ?? null,
        first_po_received_at: prior?.first_po_received_at ?? null,
      },
      payload: body,
    })
    return Response.json(milestone)
  } catch (error) {
    return jsonError(error, 'Failed to update milestone')
  }
}
