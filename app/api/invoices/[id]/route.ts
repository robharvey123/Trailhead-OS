import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { getApiKeyAuth } from '@/lib/api/auth'
import { getAccountById } from '@/lib/db/accounts'
import { getContactById } from '@/lib/db/contacts'
import { getInvoiceById, updateInvoice } from '@/lib/db/invoices'
import { deriveInvoiceBillTo } from '@/lib/invoice-bill-to'
import { calculateTotals, type InvoiceStatus, type LineItem } from '@/lib/types'

const INVOICE_STATUSES = new Set<InvoiceStatus>([
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled',
])

async function getAuthenticatedSupabase() {
  const apiKeyAuth = await getApiKeyAuth()
  if (apiKeyAuth) {
    return { supabase: apiKeyAuth.supabase, response: null }
  }

  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      supabase,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { supabase, response: null }
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function sanitizeLineItems(value: unknown): LineItem[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const items = value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const record = item as Record<string, unknown>
      const description = sanitizeText(record.description) ?? ''
      const qty = Number(record.qty)
      const unitPrice = Number(record.unit_price)

      if (!description || !Number.isFinite(qty) || qty < 1 || !Number.isFinite(unitPrice) || unitPrice < 0) {
        return null
      }

      return {
        id:
          typeof record.id === 'string' && record.id.trim()
            ? record.id
            : crypto.randomUUID(),
        description,
        qty,
        unit_price: unitPrice,
      }
    })
    .filter((item): item is LineItem => item !== null)

  return items.length ? items : null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) {
    return auth.response
  }

  const { id } = await params

  try {
    const invoice = await getInvoiceById(id, auth.supabase)
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json({ invoice })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load invoice' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) {
    return auth.response
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  const existing = await getInvoiceById(id, auth.supabase)

  if (!existing) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  if (body.contact_id !== undefined) {
    if (body.contact_id !== null && typeof body.contact_id !== 'string') {
      return NextResponse.json(
        { error: 'contact_id must be a string or null' },
        { status: 400 }
      )
    }
    patch.contact_id = body.contact_id
  }

  if (body.account_id !== undefined) {
    if (body.account_id !== null && typeof body.account_id !== 'string') {
      return NextResponse.json(
        { error: 'account_id must be a string or null' },
        { status: 400 }
      )
    }
    patch.account_id = body.account_id
  }

  if (body.workstream_id !== undefined) {
    if (body.workstream_id !== null && typeof body.workstream_id !== 'string') {
      return NextResponse.json(
        { error: 'workstream_id must be a string or null' },
        { status: 400 }
      )
    }
    patch.workstream_id = body.workstream_id
  }

  if (body.pricing_tier_id !== undefined) {
    if (body.pricing_tier_id !== null && typeof body.pricing_tier_id !== 'string') {
      return NextResponse.json(
        { error: 'pricing_tier_id must be a string or null' },
        { status: 400 }
      )
    }
    patch.pricing_tier_id = body.pricing_tier_id
  }

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !INVOICE_STATUSES.has(body.status as InvoiceStatus)) {
      return NextResponse.json(
        { error: 'Invalid invoice status' },
        { status: 400 }
      )
    }

    patch.status = body.status

    // Keep paid_at consistent with manual status changes: stamp it when moving
    // into 'paid' (if not already set), clear it when moving out of 'paid'.
    if (body.status === 'paid' && !existing.paid_at) {
      patch.paid_at = new Date().toISOString()
    } else if (body.status !== 'paid' && existing.paid_at) {
      patch.paid_at = null
    }
  }

  if (body.issue_date !== undefined) {
    patch.issue_date = typeof body.issue_date === 'string' ? body.issue_date : null
  }

  if (body.due_date !== undefined) {
    if (body.due_date !== null && typeof body.due_date !== 'string') {
      return NextResponse.json(
        { error: 'due_date must be a string or null' },
        { status: 400 }
      )
    }
    patch.due_date = body.due_date
  }

  if (body.vat_rate !== undefined) {
    const vatRate = Number(body.vat_rate)
    if (!Number.isFinite(vatRate)) {
      return NextResponse.json({ error: 'vat_rate must be numeric' }, { status: 400 })
    }
    patch.vat_rate = vatRate
  }

  if (body.notes !== undefined) {
    patch.notes = sanitizeText(body.notes)
  }

  if (body.is_recurring !== undefined) {
    patch.is_recurring = body.is_recurring === true
  }

  if (body.recurring_interval !== undefined) {
    if (body.recurring_interval !== null && body.recurring_interval !== 'month' && body.recurring_interval !== 'year') {
      return NextResponse.json({ error: 'recurring_interval must be month, year, or null' }, { status: 400 })
    }
    patch.recurring_interval = body.recurring_interval
  }

  if (body.next_invoice_date !== undefined) {
    patch.next_invoice_date = body.next_invoice_date === null ? null : String(body.next_invoice_date)
  }

  const accountIdChanged = body.account_id !== undefined
  const contactIdChanged = body.contact_id !== undefined
  const billToFieldKeys = [
    'bill_to_name',
    'bill_to_address',
    'bill_to_city',
    'bill_to_postcode',
    'bill_to_country',
    'bill_to_email',
    'bill_to_phone',
  ] as const
  const hasBillToPatch = billToFieldKeys.some((key) => key in body)

  if (accountIdChanged || contactIdChanged || hasBillToPatch) {
    const nextAccountId = (patch.account_id as string | null | undefined) ?? existing.account_id
    const nextContactId = (patch.contact_id as string | null | undefined) ?? existing.contact_id
    const [account, contact] = await Promise.all([
      nextAccountId ? getAccountById(nextAccountId, auth.supabase).catch(() => null) : null,
      nextContactId ? getContactById(nextContactId, auth.supabase).catch(() => null) : null,
    ])
    const derivedBillTo = deriveInvoiceBillTo(account, contact)

    if (body.bill_to_name !== undefined || accountIdChanged || contactIdChanged) {
      patch.bill_to_name = sanitizeText(body.bill_to_name) ?? derivedBillTo.bill_to_name
    }
    if (body.bill_to_address !== undefined || accountIdChanged || contactIdChanged) {
      patch.bill_to_address = sanitizeText(body.bill_to_address) ?? derivedBillTo.bill_to_address
    }
    if (body.bill_to_city !== undefined || accountIdChanged || contactIdChanged) {
      patch.bill_to_city = sanitizeText(body.bill_to_city) ?? derivedBillTo.bill_to_city
    }
    if (body.bill_to_postcode !== undefined || accountIdChanged || contactIdChanged) {
      patch.bill_to_postcode = sanitizeText(body.bill_to_postcode) ?? derivedBillTo.bill_to_postcode
    }
    if (body.bill_to_country !== undefined || accountIdChanged || contactIdChanged) {
      patch.bill_to_country = sanitizeText(body.bill_to_country) ?? derivedBillTo.bill_to_country
    }
    if (body.bill_to_email !== undefined || accountIdChanged || contactIdChanged) {
      patch.bill_to_email = sanitizeText(body.bill_to_email) ?? derivedBillTo.bill_to_email
    }
    if (body.bill_to_phone !== undefined || accountIdChanged || contactIdChanged) {
      patch.bill_to_phone = sanitizeText(body.bill_to_phone) ?? derivedBillTo.bill_to_phone
    }
  }

  if (body.line_items !== undefined) {
    const lineItems = sanitizeLineItems(body.line_items)
    if (!lineItems) {
      return NextResponse.json(
        { error: 'At least one valid line item is required' },
        { status: 400 }
      )
    }
    patch.line_items = lineItems
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
  }

  const nextLineItems = (patch.line_items as LineItem[] | undefined) ?? undefined
  const nextVatRate = typeof patch.vat_rate === 'number' ? patch.vat_rate : undefined
  if (nextLineItems || nextVatRate !== undefined) {
    const totals = calculateTotals(
      nextLineItems ?? [],
      nextVatRate ?? 0
    )
    if (!Number.isFinite(totals.total)) {
      return NextResponse.json({ error: 'Invalid invoice totals' }, { status: 400 })
    }
  }

  try {
    const invoice = await updateInvoice(id, patch, auth.supabase)
    return NextResponse.json({ invoice })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update invoice' },
      { status: 500 }
    )
  }
}
