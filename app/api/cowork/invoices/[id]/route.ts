import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  INVOICE_SELECT,
  formatInvoice,
  getInvoiceById,
  getWorkstreamBySlug,
  jsonError,
  optionalDate,
  optionalString,
  parseInvoiceCurrencyFields,
  parseInvoiceStatus,
  parseLineItems,
  parseVatRate,
  sendCoworkInvoicePaidNotification,
} from '@/lib/cowork-api'
import { getEngagementRow } from '@/lib/cowork-engagements'
import { recordCoworkPayment } from '@/lib/cowork-invoices'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { supabaseService } from '@/lib/supabase/service'

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    // PATCH on a soft-deleted invoice 404s, consistent with GET: getInvoiceById
    // filters deleted_at, so `existing` is never a deleted row.
    const existing = await getInvoiceById(id)
    const body = await request.json().catch(() => ({}))
    const patch: Record<string, unknown> = {}

    // paid / part_paid go through the payments ledger, never a direct write.
    let markPaid = false
    if (body.status !== undefined) {
      const status = parseInvoiceStatus(body.status)
      if (status === 'part_paid') {
        return Response.json(
          { error: 'Record a partial payment instead: POST /api/cowork/invoices/{id}/payments' },
          { status: 409 }
        )
      }
      if (status === 'paid') markPaid = true
      else patch.status = status
    }

    if (body.due_date !== undefined) patch.due_date = optionalDate(body.due_date, 'due_date')
    if (body.notes !== undefined) patch.notes = optionalString(body.notes)
    if (body.vat_rate !== undefined) patch.vat_rate = parseVatRate(body.vat_rate)
    if (body.account_id !== undefined) patch.account_id = optionalString(body.account_id)
    if (body.contact_id !== undefined) patch.contact_id = optionalString(body.contact_id)

    if (body.engagement_id !== undefined) {
      const ref = optionalString(body.engagement_id)
      patch.engagement_id = ref ? (await getEngagementRow(ref)).id : null
    }
    if (body.stripe_payment_link !== undefined) patch.stripe_payment_link = optionalString(body.stripe_payment_link)

    if (body.workstream !== undefined) {
      const slug = optionalString(body.workstream)
      patch.workstream_id = slug ? (await getWorkstreamBySlug(slug)).id : null
    }

    if (body.tier !== undefined || body.pricing_tier_id !== undefined) {
      return Response.json({ error: 'Pricing tiers are no longer supported on invoices' }, { status: 400 })
    }

    if (body.line_items !== undefined) {
      patch.line_items = parseLineItems(body.line_items)
    }

    // Currency + FX snapshot. Frozen once sent (409). While draft, the FX rate can
    // be corrected, but the currency itself cannot be switched: line-item prices do
    // not convert themselves, so relabelling 3500 GBP as $3500 would misprice the
    // invoice. Blocking is safer than repricing — raise a new invoice instead.
    if (body.currency !== undefined || body.fx_rate_to_gbp !== undefined || body.fx_rate_quote !== undefined) {
      if (existing.status !== 'draft') {
        return Response.json({ error: 'Currency and FX rate are frozen once an invoice leaves draft.' }, { status: 409 })
      }
      const cf = parseInvoiceCurrencyFields({ ...body, currency: body.currency ?? existing.currency })
      const existingCurrency = (existing.currency as string | null) ?? 'GBP'
      if (cf.currency !== existingCurrency) {
        return Response.json(
          { error: `Cannot change an invoice from ${existingCurrency} to ${cf.currency}; line items do not convert. Raise a new ${cf.currency} invoice instead.` },
          { status: 409 }
        )
      }
      patch.currency = cf.currency
      patch.fx_rate_to_gbp = cf.fx_rate_to_gbp
      patch.fx_rate_quote = cf.fx_rate_quote
      patch.fx_rate_date = cf.fx_rate_date
      patch.fx_rate_source = cf.fx_rate_source
    }

    if (Object.keys(patch).length === 0 && !markPaid) {
      return Response.json({ error: 'No changes supplied' }, { status: 400 })
    }

    let data: Record<string, unknown>
    if (Object.keys(patch).length > 0) {
      const { data: row, error } = await supabaseService
        .from('invoices')
        .update(patch)
        .eq('id', id)
        .select(INVOICE_SELECT)
        .single()
      if (error) {
        throw error
      }
      data = row as Record<string, unknown>
    } else {
      data = existing as unknown as Record<string, unknown>
    }

    if (markPaid) {
      const paid = await recordCoworkPayment(id, { paid_on: optionalString(body.paid_on) })
      if (existing.status !== 'paid' && paid.status === 'paid') {
        void sendCoworkInvoicePaidNotification({ id: paid.id, invoice_number: paid.invoice_number }).catch(() => {})
        void recordCoworkWrite({
          action: 'update',
          entity: 'invoice',
          entityId: paid.id,
          entityLabel: paid.invoice_number,
          summary: `Marked invoice ${paid.invoice_number} paid via a ledger payment (was ${existing.status})`,
          before: { status: existing.status },
          payload: { status: 'paid' },
        })
      }
      return Response.json(paid)
    }

    const updated = formatInvoice(data as never)
    // Record the status change with `before` so it can be reverted from the log.
    if (patch.status !== undefined && existing.status !== updated.status) {
      void recordCoworkWrite({
        action: 'update',
        entity: 'invoice',
        entityId: updated.id,
        entityLabel: updated.invoice_number,
        engagementId: (data as { engagement_id?: string | null }).engagement_id ?? null,
        summary: `Marked invoice ${updated.invoice_number} ${updated.status} (was ${existing.status})`,
        before: { status: existing.status },
        payload: { status: updated.status },
      })
    }
    return Response.json(updated)
  } catch (error) {
    return jsonError(error, 'Failed to update invoice')
  }
}
