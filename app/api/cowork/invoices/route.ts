import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  INVOICE_SELECT,
  formatInvoice,
  getWorkstreamBySlug,
  jsonError,
  parseInvoiceListStatus,
  parseLimit,
} from '@/lib/cowork-api'
import { createCoworkInvoice } from '@/lib/cowork-invoices'
import { getEngagementRow } from '@/lib/cowork-engagements'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { supabaseService } from '@/lib/supabase/service'
import { formatMoney } from '@/lib/money'

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const workstreamSlug = searchParams.get('workstream')
    const status = parseInvoiceListStatus(searchParams.get('status'))
    const engagementRef = searchParams.get('engagement_id') ?? searchParams.get('engagement')
    const limit = parseLimit(searchParams.get('limit'), 20, 100)
    const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null
    // getEngagementRow 404s on an unknown ref — a garbage filter returns no rows,
    // never the whole table.
    const engagement = engagementRef ? await getEngagementRow(engagementRef) : null

    let query = supabaseService
      .from('invoices')
      .select(INVOICE_SELECT)
      .is('deleted_at', null)
      .order('issue_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    if (workstream) {
      query = query.eq('workstream_id', workstream.id)
    }

    if (engagement) {
      query = query.eq('engagement_id', engagement.id)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return Response.json((data ?? []).map((row) => formatInvoice(row as never)))
  } catch (error) {
    return jsonError(error, 'Failed to load invoices')
  }
}

export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { invoice, engagement } = await createCoworkInvoice(body)
    const amount = formatMoney(invoice.total, invoice.currency)
    const gbpEquiv = invoice.currency === 'GBP' ? '' : ` (${formatMoney(invoice.total_gbp, 'GBP')})`
    void recordCoworkWrite({
      action: 'create',
      entity: 'invoice',
      entityId: invoice.id,
      entityLabel: invoice.invoice_number,
      engagementId: engagement?.id ?? null,
      summary: `Raised ${invoice.status} invoice ${invoice.invoice_number}, ${amount}${gbpEquiv}, ${invoice.title}${invoice.account ? `, ${invoice.account.name}` : ''}${engagement ? ` (${engagement.name})` : ''}`,
      payload: { line_items: invoice.line_items, status: invoice.status, currency: invoice.currency, fx_rate_to_gbp: invoice.fx_rate_to_gbp, engagement_id: engagement?.id ?? null },
    })
    return Response.json(invoice, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create invoice')
  }
}
