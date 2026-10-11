import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  formatInvoice,
  getInvoiceById,
  jsonError,
  sendCoworkInvoicePaidNotification,
} from '@/lib/cowork-api'
import { deleteCoworkInvoice, updateCoworkInvoice } from '@/lib/cowork-invoices'
import { recordCoworkWrite } from '@/lib/cowork-audit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    const invoice = await getInvoiceById(id)
    return Response.json(formatInvoice(invoice))
  } catch (error) {
    return jsonError(error, 'Failed to load invoice')
  }
}

// PATCH — see updateCoworkInvoice (lib/cowork-invoices.ts). Every changed field
// is logged with its previous value in `before`; a status change stays revertible
// from the activity log.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { invoice, priorStatus, before, changed, paidViaLedger } = await updateCoworkInvoice(id, body)

    if (changed.length > 0) {
      const others = changed.filter((key) => key !== 'status')
      void recordCoworkWrite({
        action: 'update',
        entity: 'invoice',
        entityId: invoice.id,
        entityLabel: invoice.invoice_number,
        engagementId: invoice.engagement?.id ?? null,
        summary:
          'status' in before
            ? `Marked invoice ${invoice.invoice_number} ${invoice.status} (was ${priorStatus})${others.length ? `; also changed ${others.join(', ')}` : ''}`
            : `Updated invoice ${invoice.invoice_number} (${others.join(', ')})`,
        before,
        payload: body,
      })
    }

    if (paidViaLedger && priorStatus !== 'paid' && invoice.status === 'paid') {
      void sendCoworkInvoicePaidNotification({ id: invoice.id, invoice_number: invoice.invoice_number }).catch(() => {})
      void recordCoworkWrite({
        action: 'update',
        entity: 'invoice',
        entityId: invoice.id,
        entityLabel: invoice.invoice_number,
        engagementId: invoice.engagement?.id ?? null,
        summary: `Marked invoice ${invoice.invoice_number} paid via a ledger payment (was ${priorStatus})`,
        before: { status: priorStatus },
        payload: { status: 'paid' },
      })
    }

    return Response.json(invoice)
  } catch (error) {
    return jsonError(error, 'Failed to update invoice')
  }
}

// DELETE — SOFT delete (deleted_at; billed time and expenses are released). 409
// when any payment is recorded or the invoice is paid / part_paid.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    const { invoice, released } = await deleteCoworkInvoice(id)
    const releasedNote = [
      released.time_entries ? `${released.time_entries} time entr${released.time_entries === 1 ? 'y' : 'ies'}` : null,
      released.expenses ? `${released.expenses} expense${released.expenses === 1 ? '' : 's'}` : null,
    ].filter(Boolean)
    void recordCoworkWrite({
      action: 'delete',
      entity: 'invoice',
      entityId: invoice.id,
      entityLabel: invoice.invoice_number,
      engagementId: invoice.engagement?.id ?? null,
      summary: `Deleted ${invoice.status} invoice ${invoice.invoice_number}${invoice.account ? `, ${invoice.account.name}` : ''} (soft delete${releasedNote.length ? `; released ${releasedNote.join(' and ')} back to unbilled` : ''})`,
      payload: { ...invoice, released },
    })
    return Response.json({ deleted: true, soft: true, invoice_number: invoice.invoice_number, released })
  } catch (error) {
    return jsonError(error, 'Failed to delete invoice')
  }
}
