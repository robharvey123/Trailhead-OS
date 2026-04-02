import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { createQuote, getQuotes } from '@/lib/db/quotes'
import type {
  PricingType,
  Quote,
  QuoteComplexityBreakdown,
  QuoteDraftContent,
  QuoteLineItem,
  QuoteScope,
  QuoteStatus,
} from '@/lib/types'

const QUOTE_STATUSES = new Set<QuoteStatus>([
  'draft',
  'review',
  'sent',
  'accepted',
  'rejected',
  'declined',
  'expired',
  'converted',
])

const PRICING_TYPES = new Set<PricingType>([
  'fixed',
  'time_and_materials',
  'milestone',
])

function sanitizeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function sanitizeScope(value: unknown): QuoteScope[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const record = item as Record<string, unknown>
      const phase = sanitizeText(record.phase)
      const description = sanitizeText(record.description)
      const duration = sanitizeText(record.duration)
      const deliverables = Array.isArray(record.deliverables)
        ? record.deliverables
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter(Boolean)
        : []

      if (!phase || !description || !duration) {
        return null
      }

      const scopeItem: QuoteScope = {
        phase,
        description,
        deliverables,
        duration,
        estimated_hours: Number.isFinite(Number(record.estimated_hours))
          ? Number(record.estimated_hours)
          : undefined,
      }

      return scopeItem
    })
    .filter((item): item is QuoteScope => item !== null)
}

function sanitizeComplexityBreakdown(value: unknown): QuoteComplexityBreakdown | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const record = value as Record<string, unknown>
  const featuresScored = Array.isArray(record.features_scored)
    ? record.features_scored
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : []
  const overheadHours = Number(record.overhead_hours)
  const totalHoursBeforeBuffer = Number(record.total_hours_before_buffer)
  const totalHoursFinal = Number(record.total_hours_final)
  const bufferApplied =
    typeof record.buffer_applied === 'string' && record.buffer_applied.trim()
      ? record.buffer_applied.trim()
      : '15%'

  if (
    !Number.isFinite(overheadHours) ||
    !Number.isFinite(totalHoursBeforeBuffer) ||
    !Number.isFinite(totalHoursFinal)
  ) {
    return undefined
  }

  return {
    features_scored: featuresScored,
    overhead_hours: overheadHours,
    total_hours_before_buffer: totalHoursBeforeBuffer,
    buffer_applied: bufferApplied,
    total_hours_final: totalHoursFinal,
  }
}

function sanitizeLineItems(value: unknown): QuoteLineItem[] {
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
      const type =
        typeof record.type === 'string' &&
        (record.type === 'fixed' || record.type === 'hourly' || record.type === 'milestone')
          ? record.type
          : 'fixed'

      if (!description || !Number.isFinite(qty) || qty < 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
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
        type,
      }
    })
    .filter((item): item is QuoteLineItem => item !== null)
}

function sanitizeDraftContent(value: unknown): QuoteDraftContent | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const record = value as Record<string, unknown>
  const overview = sanitizeText(record.overview)
  const approach = sanitizeText(record.approach)
  const nextSteps = sanitizeText(record.next_steps)
  const scope = Array.isArray(record.scope)
    ? record.scope.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
    : []
  const assumptions = Array.isArray(record.assumptions)
    ? record.assumptions.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
    : []
  const pricing = Array.isArray(record.pricing)
    ? record.pricing
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null
          }

          const pricingRecord = entry as Record<string, unknown>
          const item = sanitizeText(pricingRecord.item)
          const description = sanitizeText(pricingRecord.description)
          const amount = sanitizeText(pricingRecord.amount)

          if (!item || !description || !amount) {
            return null
          }

          return { item, description, amount }
        })
        .filter((entry): entry is QuoteDraftContent['pricing'][number] => entry !== null)
    : []

  if (!overview || !approach || !nextSteps) {
    return undefined
  }

  return {
    overview,
    approach,
    scope,
    assumptions,
    pricing,
    next_steps: nextSteps,
  }
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const quotes = await getQuotes(
      {
        status:
          status && QUOTE_STATUSES.has(status as QuoteStatus)
            ? (status as QuoteStatus)
            : undefined,
        workstream_id: searchParams.get('workstream_id') ?? undefined,
        account_id: searchParams.get('account_id') ?? undefined,
        project_id: searchParams.get('project_id') ?? undefined,
      },
      auth.supabase
    )

    return NextResponse.json({ quotes })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load quotes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const body = await request.json().catch(() => ({}))
  const title = sanitizeText(body.title) ?? ''

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const status =
    typeof body.status === 'string' && QUOTE_STATUSES.has(body.status as QuoteStatus)
      ? (body.status as QuoteStatus)
      : 'draft'

  const pricingType =
    typeof body.pricing_type === 'string' && PRICING_TYPES.has(body.pricing_type as PricingType)
      ? (body.pricing_type as PricingType)
      : 'fixed'

  try {
    const quote = await createQuote(
      {
        account_id:
          body.account_id === null || body.account_id === undefined
            ? undefined
            : typeof body.account_id === 'string'
              ? body.account_id
              : undefined,
        contact_id:
          body.contact_id === null || body.contact_id === undefined
            ? undefined
            : typeof body.contact_id === 'string'
              ? body.contact_id
              : undefined,
        workstream_id:
          body.workstream_id === null || body.workstream_id === undefined
            ? undefined
            : typeof body.workstream_id === 'string'
              ? body.workstream_id
              : undefined,
        project_id:
          body.project_id === null || body.project_id === undefined
            ? undefined
            : typeof body.project_id === 'string'
              ? body.project_id
              : undefined,
        enquiry_id:
          body.enquiry_id === null || body.enquiry_id === undefined
            ? undefined
            : typeof body.enquiry_id === 'string'
              ? body.enquiry_id
              : undefined,
        pricing_tier_id:
          body.pricing_tier_id === null || body.pricing_tier_id === undefined
            ? undefined
            : typeof body.pricing_tier_id === 'string'
              ? body.pricing_tier_id
              : undefined,
        status,
        pricing_type: pricingType,
        title,
        summary: sanitizeText(body.summary) ?? undefined,
        estimated_hours: Number.isFinite(Number(body.estimated_hours))
          ? Number(body.estimated_hours)
          : undefined,
        estimated_timeline: sanitizeText(body.estimated_timeline) ?? undefined,
        draft_content: sanitizeDraftContent(body.draft_content),
        final_content: sanitizeDraftContent(body.final_content),
        version: Number.isFinite(Number(body.version)) ? Number(body.version) : 1,
        generated_at:
          typeof body.generated_at === 'string' && body.generated_at.trim()
            ? body.generated_at
            : undefined,
        sent_at:
          typeof body.sent_at === 'string' && body.sent_at.trim()
            ? body.sent_at
            : undefined,
        created_by_id: auth.user.id,
        scope: sanitizeScope(body.scope),
        line_items: sanitizeLineItems(body.line_items),
        vat_rate: Number.isFinite(Number(body.vat_rate)) ? Number(body.vat_rate) : 20,
        valid_until:
          typeof body.valid_until === 'string' && body.valid_until.trim()
            ? body.valid_until
            : undefined,
        payment_terms:
          sanitizeText(body.payment_terms) ??
          'Payment terms: 50% deposit on acceptance, 50% on completion.',
        notes: sanitizeText(body.notes) ?? undefined,
        complexity_breakdown: sanitizeComplexityBreakdown(body.complexity_breakdown),
        converted_invoice_id:
          body.converted_invoice_id === null || body.converted_invoice_id === undefined
            ? undefined
            : typeof body.converted_invoice_id === 'string'
              ? body.converted_invoice_id
              : undefined,
        ai_generated: body.ai_generated === true,
        ai_generated_at:
          typeof body.ai_generated_at === 'string' && body.ai_generated_at.trim()
            ? body.ai_generated_at
            : body.ai_generated === true
              ? new Date().toISOString()
              : undefined,
        issue_date:
          typeof body.issue_date === 'string' && body.issue_date.trim()
            ? body.issue_date
            : new Date().toISOString().slice(0, 10),
      } satisfies Omit<Quote, 'id' | 'quote_number' | 'created_at' | 'updated_at'>,
      auth.supabase
    )

    return NextResponse.json({ quote }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create quote' },
      { status: 500 }
    )
  }
}
