import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  INVOICE_SELECT,
  findAccountByName,
  findContactByName,
  findPricingTierBySlug,
  formatInvoice,
  getWorkstreamBySlug,
  jsonError,
  optionalDate,
  optionalString,
  parseInvoiceListStatus,
  parseLineItems,
  parseLimit,
  parseVatRate,
  todayDate,
} from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const workstreamSlug = searchParams.get('workstream')
    const status = parseInvoiceListStatus(searchParams.get('status'))
    const limit = parseLimit(searchParams.get('limit'), 20, 100)
    const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null

    let query = supabaseService
      .from('invoices')
      .select(INVOICE_SELECT)
      .order('issue_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    if (workstream) {
      query = query.eq('workstream_id', workstream.id)
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
    const workstreamSlug = optionalString(body.workstream)
    const contactName = optionalString(body.contact_name)
    const accountName = optionalString(body.account_name)
    const tierSlug = optionalString(body.tier)
    const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null
    const lineItems = parseLineItems(body.line_items)
    const status = body.status === undefined ? 'draft' : optionalString(body.status)

    if (status !== 'draft' && status !== 'sent') {
      return Response.json({ error: 'status must be draft or sent' }, { status: 400 })
    }

    const contact = contactName ? await findContactByName(contactName) : null
    const account = accountName
      ? await findAccountByName(accountName)
      : contact?.account_id
        ? { id: contact.account_id, name: '' }
        : null
    const pricingTier = tierSlug ? await findPricingTierBySlug(tierSlug) : null

    if (contactName && !contact) {
      return Response.json({ error: `Contact not found: ${contactName}` }, { status: 400 })
    }

    if (accountName && !account) {
      return Response.json({ error: `Account not found: ${accountName}` }, { status: 400 })
    }

    const { data, error } = await supabaseService
      .from('invoices')
      .insert({
        contact_id: contact?.id ?? null,
        account_id: account?.id ?? null,
        workstream_id: workstream?.id ?? null,
        pricing_tier_id: pricingTier?.id ?? null,
        issue_date: todayDate(),
        due_date: optionalDate(body.due_date, 'due_date'),
        vat_rate: parseVatRate(body.vat_rate),
        line_items: lineItems,
        notes: optionalString(body.notes),
        status,
      })
      .select(INVOICE_SELECT)
      .single()

    if (error) {
      throw error
    }

    return Response.json(formatInvoice(data as never), { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create invoice')
  }
}
