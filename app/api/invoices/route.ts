import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { getApiKeyAuth } from '@/lib/api/auth'
import { getAccountById } from '@/lib/db/accounts'
import { getContactById } from '@/lib/db/contacts'
import { createInvoice, getInvoices } from '@/lib/db/invoices'
import { deriveInvoiceBillTo } from '@/lib/invoice-bill-to'
import { getCompanySettings } from '@/lib/company-settings'
import { parseInvoiceCurrencyFields, CoworkApiError } from '@/lib/cowork-api'
import { calculateTotals, type Invoice, type InvoiceStatus, type LineItem } from '@/lib/types'

// paid / part_paid are derived from the payments ledger, never set directly.
const CREATABLE_STATUSES = new Set<InvoiceStatus>(['draft', 'sent', 'overdue', 'cancelled'])
const LISTABLE_STATUSES = new Set<InvoiceStatus>(['draft', 'sent', 'part_paid', 'paid', 'overdue', 'cancelled'])

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

function sanitizeLineItems(value: unknown): LineItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
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
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) {
    return auth.response
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const invoices = await getInvoices(
      {
        status:
          status && LISTABLE_STATUSES.has(status as InvoiceStatus)
            ? (status as InvoiceStatus)
            : undefined,
        workstream_id: searchParams.get('workstream_id') ?? undefined,
        account_id: searchParams.get('account_id') ?? undefined,
      },
      auth.supabase
    )

    return NextResponse.json({ invoices })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load invoices' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) {
    return auth.response
  }

  const body = await request.json().catch(() => ({}))

  // Pricing tiers are gone from invoicing (v2 phase 1). Fail loudly on stale callers.
  if (body.pricing_tier_id !== undefined) {
    return NextResponse.json({ error: 'pricing_tier_id is no longer supported on invoices' }, { status: 400 })
  }

  const lineItems = sanitizeLineItems(body.line_items)

  if (!lineItems.length) {
    return NextResponse.json(
      { error: 'At least one valid line item is required' },
      { status: 400 }
    )
  }

  const status =
    typeof body.status === 'string' && CREATABLE_STATUSES.has(body.status as InvoiceStatus)
      ? (body.status as InvoiceStatus)
      : 'draft'

  const accountId =
    body.account_id === null || body.account_id === undefined
      ? null
      : typeof body.account_id === 'string'
        ? body.account_id
        : null
  const contactId =
    body.contact_id === null || body.contact_id === undefined
      ? null
      : typeof body.contact_id === 'string'
        ? body.contact_id
        : null

  const [account, contact] = await Promise.all([
    accountId ? getAccountById(accountId, auth.supabase).catch(() => null) : null,
    contactId ? getContactById(contactId, auth.supabase).catch(() => null) : null,
  ])
  const derivedBillTo = deriveInvoiceBillTo(account, contact)

  // When the caller doesn't specify a VAT rate, default from registration
  // status: 20% if VAT-registered, otherwise 0% (don't charge VAT unregistered).
  let defaultVatRate = 0
  if (!Number.isFinite(Number(body.vat_rate))) {
    try {
      const settings = await getCompanySettings(auth.supabase)
      defaultVatRate = settings.vat_registered ? 20 : 0
    } catch {
      defaultVatRate = 0
    }
  }

  let currencyFields
  try {
    currencyFields = parseInvoiceCurrencyFields(body)
  } catch (e) {
    if (e instanceof CoworkApiError) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }

  const payload: Omit<Invoice, 'id' | 'invoice_number' | 'created_at' | 'updated_at'> = {
    account_id: accountId,
    contact_id: contactId,
    workstream_id:
      body.workstream_id === null || body.workstream_id === undefined
        ? null
        : typeof body.workstream_id === 'string'
          ? body.workstream_id
          : null,
    status,
    issue_date:
      typeof body.issue_date === 'string' && body.issue_date.trim()
        ? body.issue_date
        : new Date().toISOString().slice(0, 10),
    due_date:
      body.due_date === null || body.due_date === undefined
        ? null
        : typeof body.due_date === 'string' && body.due_date.trim()
          ? body.due_date
          : null,
    line_items: lineItems,
    vat_rate: Number.isFinite(Number(body.vat_rate)) ? Number(body.vat_rate) : defaultVatRate,
    currency: currencyFields.currency,
    fx_rate_to_gbp: currencyFields.fx_rate_to_gbp,
    fx_rate_quote: currencyFields.fx_rate_quote,
    fx_rate_date: currencyFields.fx_rate_date,
    fx_rate_source: currencyFields.fx_rate_source,
      bill_to_name: sanitizeText(body.bill_to_name) ?? derivedBillTo.bill_to_name,
      bill_to_address: sanitizeText(body.bill_to_address) ?? derivedBillTo.bill_to_address,
      bill_to_city: sanitizeText(body.bill_to_city) ?? derivedBillTo.bill_to_city,
      bill_to_postcode: sanitizeText(body.bill_to_postcode) ?? derivedBillTo.bill_to_postcode,
      bill_to_country: sanitizeText(body.bill_to_country) ?? derivedBillTo.bill_to_country,
      bill_to_email: sanitizeText(body.bill_to_email) ?? derivedBillTo.bill_to_email,
      bill_to_phone: sanitizeText(body.bill_to_phone) ?? derivedBillTo.bill_to_phone,
      bill_to_vat_number: sanitizeText(body.bill_to_vat_number) ?? derivedBillTo.bill_to_vat_number,
      bill_to_company_number: sanitizeText(body.bill_to_company_number) ?? derivedBillTo.bill_to_company_number,
    po_number: sanitizeText(body.po_number),
    vat_note: sanitizeText(body.vat_note),
    notes: sanitizeText(body.notes),
    is_recurring: body.is_recurring === true,
    recurring_interval:
      body.is_recurring === true && (body.recurring_interval === 'month' || body.recurring_interval === 'year')
        ? body.recurring_interval
        : null,
  }

  const totals = calculateTotals(payload.line_items, payload.vat_rate)
  if (!Number.isFinite(totals.total)) {
    return NextResponse.json({ error: 'Invalid invoice totals' }, { status: 400 })
  }

  if (payload.is_recurring && payload.recurring_interval) {
    const base = new Date(payload.issue_date)
    if (payload.recurring_interval === 'month') {
      base.setMonth(base.getMonth() + 1)
    } else {
      base.setFullYear(base.getFullYear() + 1)
    }
    ;(payload as Record<string, unknown>).next_invoice_date = base.toISOString().slice(0, 10)
  }

  try {
    const invoice = await createInvoice(payload, auth.supabase)
    return NextResponse.json({ invoice }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create invoice' },
      { status: 500 }
    )
  }
}
