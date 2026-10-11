import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { deleteCoworkPayment, updateCoworkPayment } from '@/lib/cowork-invoices'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { formatMoney } from '@/lib/money'

type Params = { params: Promise<{ id: string; paymentId: string }> }

// PATCH — correct a ledger payment: { paid_on?, amount?, method?, reference?, notes? }.
// Same rules as recording one; the invoice's status and paid_at are re-derived.
export async function PATCH(request: NextRequest, { params }: Params) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id, paymentId } = await params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const { payment, invoice, before, priorStatus } = await updateCoworkPayment(id, paymentId, body)
    void recordCoworkWrite({
      action: 'update',
      entity: 'invoice_payment',
      entityId: payment.id,
      entityLabel: invoice.invoice_number,
      engagementId: invoice.engagement?.id ?? null,
      summary: `Corrected a payment on ${invoice.invoice_number} — now ${formatMoney(payment.amount, invoice.currency)} on ${payment.paid_on} (${Object.keys(before).join(', ')})${invoice.status !== priorStatus ? `; invoice now ${invoice.status} (was ${priorStatus})` : ''}`,
      before,
      payload: body,
    })
    return Response.json({ payment, invoice })
  } catch (error) {
    return jsonError(error, 'Failed to update payment')
  }
}

// DELETE — permanently remove a ledger payment; the invoice's status and paid_at
// are re-derived (a paid invoice drops back to sent / overdue / part_paid).
export async function DELETE(request: NextRequest, { params }: Params) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id, paymentId } = await params
    const { payment, invoice, priorStatus } = await deleteCoworkPayment(id, paymentId)
    void recordCoworkWrite({
      action: 'delete',
      entity: 'invoice_payment',
      entityId: payment.id,
      entityLabel: invoice.invoice_number,
      engagementId: invoice.engagement?.id ?? null,
      summary: `Deleted a ${formatMoney(payment.amount, invoice.currency)} payment dated ${payment.paid_on} from ${invoice.invoice_number}${invoice.status !== priorStatus ? `; invoice now ${invoice.status} (was ${priorStatus})` : ''}`,
      payload: payment,
    })
    return Response.json({ deleted: true, invoice })
  } catch (error) {
    return jsonError(error, 'Failed to delete payment')
  }
}
