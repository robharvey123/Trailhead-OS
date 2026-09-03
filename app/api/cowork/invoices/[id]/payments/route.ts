import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError, optionalString } from '@/lib/cowork-api'
import { listCoworkPayments, recordCoworkPayment } from '@/lib/cowork-invoices'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { formatMoney } from '@/lib/money'

// GET /api/cowork/invoices/[id]/payments — the ledger plus { total, amount_paid, balance }.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id } = await params
    return Response.json(await listCoworkPayments(id))
  } catch (error) {
    return jsonError(error, 'Failed to load payments')
  }
}

// POST — record a payment. { paid_on?, amount?, method?, reference?, notes? }.
// Amount defaults to the outstanding balance; paid_on defaults to today and may
// be back-dated. Status and paid_at are derived from the ledger afterwards.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const invoice = await recordCoworkPayment(id, {
      paid_on: optionalString(body.paid_on),
      amount: body.amount == null ? null : Number(body.amount),
      method: optionalString(body.method),
      reference: optionalString(body.reference),
      notes: optionalString(body.notes),
    })
    void recordCoworkWrite({
      action: 'create',
      entity: 'invoice_payment',
      entityId: invoice.id,
      entityLabel: invoice.invoice_number,
      summary: `Recorded a payment on ${invoice.invoice_number}${body.amount != null ? ` of ${formatMoney(Number(body.amount), invoice.currency)}` : ' for the full balance'}${body.paid_on ? ` dated ${body.paid_on}` : ''} — status now ${invoice.status}`,
      payload: body,
    })
    return Response.json(invoice, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to record payment')
  }
}
