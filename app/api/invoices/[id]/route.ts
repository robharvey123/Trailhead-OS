import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { getInvoiceById, updateInvoice } from '@/lib/db/invoices'
import { calculateTotals, type InvoiceStatus, type LineItem } from '@/lib/types'

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

  if (body.contact_id !== undefined) {
    if (body.contact_id !== null && typeof body.contact_id !== 'string') {
      return NextResponse.json(
        { error: 'contact_id must be a string or null' },
        { status: 400 }
      )
    }
    patch.contact_id = body.contact_id
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

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !INVOICE_STATUSES.has(body.status as InvoiceStatus)) {
      return NextResponse.json(
        { error: 'Invalid invoice status' },
        { status: 400 }
      )
    }

    patch.status = body.status
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
    const existing = await getInvoiceById(id, auth.supabase)
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = await updateInvoice(id, patch, auth.supabase)
    return NextResponse.json({ invoice })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update invoice' },
      { status: 500 }
    )
  }
}
