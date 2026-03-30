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
  parseInvoiceStatus,
  parseLineItems,
  parseVatRate,
  sendCoworkInvoicePaidNotification,
} from '@/lib/cowork-api'
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

    return Response.json(formatInvoice(data as never))
  } catch (error) {
    return jsonError(error, 'Failed to update invoice')
  }
}
