import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { createInvoice, getInvoices } from '@/lib/db/invoices'
import { calculateTotals, type Invoice, type InvoiceStatus, type LineItem } from '@/lib/types'

const INVOICE_STATUSES = new Set<InvoiceStatus>([
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled',
])

async function getAuthenticatedSupabase() {
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
          status && INVOICE_STATUSES.has(status as InvoiceStatus)
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
  const lineItems = sanitizeLineItems(body.line_items)

  if (!lineItems.length) {
    return NextResponse.json(
      { error: 'At least one valid line item is required' },
      { status: 400 }
    )
  }

  const status =
    typeof body.status === 'string' && INVOICE_STATUSES.has(body.status as InvoiceStatus)
      ? (body.status as InvoiceStatus)
      : 'draft'

  const payload: Omit<Invoice, 'id' | 'invoice_number' | 'created_at' | 'updated_at'> = {
    account_id:
      body.account_id === null || body.account_id === undefined
        ? null
        : typeof body.account_id === 'string'
          ? body.account_id
          : null,
    contact_id:
      body.contact_id === null || body.contact_id === undefined
        ? null
        : typeof body.contact_id === 'string'
          ? body.contact_id
          : null,
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
    vat_rate: Number.isFinite(Number(body.vat_rate)) ? Number(body.vat_rate) : 20,
    notes: sanitizeText(body.notes),
  }

  const totals = calculateTotals(payload.line_items, payload.vat_rate)
  if (!Number.isFinite(totals.total)) {
    return NextResponse.json({ error: 'Invalid invoice totals' }, { status: 400 })
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
