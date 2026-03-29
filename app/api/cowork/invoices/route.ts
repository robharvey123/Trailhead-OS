import { NextRequest, NextResponse } from 'next/server'
import {
  CoworkApiError,
  getWorkstreamBySlug,
  jsonError,
  mapInvoice,
  optionalDate,
  optionalString,
  parseInvoiceListStatus,
  parseLineItems,
  parseVatRate,
  requireCoworkAuth,
  todayDate,
} from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'

const PRICING_TIER_SLUGS = new Set(['mates', 'budget', 'standard'])

export async function GET(request: NextRequest) {
  const unauthorised = requireCoworkAuth(request)
  if (unauthorised) {
    return unauthorised
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const workstreamSlug = searchParams.get('workstream')
    const status = parseInvoiceListStatus(searchParams.get('status'))
    const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null

    let query = supabaseService
      .from('invoices')
      .select('id, invoice_number, contact_id, workstream_id, status, issue_date, due_date, line_items, vat_rate, notes, created_at, updated_at, contacts(name), workstreams(slug, label)')
      .order('issue_date', { ascending: false })
      .order('created_at', { ascending: false })

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

    return NextResponse.json((data ?? []).map((row) => mapInvoice(row)))
  } catch (error) {
    return jsonError(error, 'Failed to load invoices')
  }
}

export async function POST(request: NextRequest) {
  const unauthorised = requireCoworkAuth(request)
  if (unauthorised) {
    return unauthorised
  }

  try {
    const body = await request.json().catch(() => ({}))
    const workstreamSlug = optionalString(body.workstream)
    const contactName = optionalString(body.contact_name)
    const tierSlug = optionalString(body.tier)
    const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null
    const lineItems = parseLineItems(body.line_items)
    const status = body.status === undefined ? 'draft' : optionalString(body.status)

    if (status !== 'draft' && status !== 'sent') {
      throw new CoworkApiError('status must be draft or sent', 400)
    }

    if (tierSlug && !PRICING_TIER_SLUGS.has(tierSlug)) {
      throw new CoworkApiError('tier must be mates, budget, or standard', 400)
    }

    let contactId: string | null = null
    let pricingTierId: string | null = null
    if (contactName) {
      const { data, error } = await supabaseService
        .from('contacts')
        .select('id')
        .ilike('name', contactName)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        throw error
      }

      contactId = data?.[0]?.id ?? null
      if (!contactId) {
        throw new CoworkApiError(`Contact not found: ${contactName}`, 400)
      }
    }

    if (tierSlug) {
      const { data, error } = await supabaseService
        .from('pricing_tiers')
        .select('id')
        .eq('slug', tierSlug)
        .maybeSingle()

      if (error) {
        throw error
      }

      if (!data?.id) {
        throw new CoworkApiError(`Pricing tier not found: ${tierSlug}`, 400)
      }

      pricingTierId = data.id
    }

    const { data, error } = await supabaseService
      .from('invoices')
      .insert({
        contact_id: contactId,
        workstream_id: workstream?.id ?? null,
        pricing_tier_id: pricingTierId,
        issue_date: todayDate(),
        due_date: optionalDate(body.due_date, 'due_date'),
        vat_rate: parseVatRate(body.vat_rate),
        line_items: lineItems,
        notes: optionalString(body.notes),
        status,
      })
      .select('id, invoice_number, contact_id, workstream_id, status, issue_date, due_date, line_items, vat_rate, notes, created_at, updated_at, contacts(name), workstreams(slug, label)')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(mapInvoice(data), { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create invoice')
  }
}
