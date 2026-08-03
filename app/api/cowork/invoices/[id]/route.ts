import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  INVOICE_SELECT,
  findPricingTierBySlug,
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

    if (body.status !== undefined) {
      patch.status = parseInvoiceStatus(body.status)
      if (patch.status === 'paid') {
        patch.paid_at = new Date().toISOString()
      }
      if (patch.status !== 'paid' && existing.paid_at) {
        patch.paid_at = null
      }
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

    if (body.tier !== undefined) {
      const tierSlug = optionalString(body.tier)
      patch.pricing_tier_id = tierSlug ? (await findPricingTierBySlug(tierSlug)).id : null
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

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'No changes supplied' }, { status: 400 })
    }

    const { data, error } = await supabaseService
      .from('invoices')
      .update(patch)
      .eq('id', id)
      .select(INVOICE_SELECT)
      .single()

    if (error) {
      throw error
    }

    if (existing.status !== 'paid' && data.status === 'paid') {
      void sendCoworkInvoicePaidNotification({
        id: String(data.id),
        invoice_number: String(data.invoice_number),
      }).catch(() => {})
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
