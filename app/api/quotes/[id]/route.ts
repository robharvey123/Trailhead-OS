import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getQuoteById, updateQuote } from '@/lib/db/quotes'
import type {
  PricingType,
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

function sanitizeScope(value: unknown): QuoteScope[] | null {
  if (!Array.isArray(value)) {
    return null
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

function sanitizeComplexityBreakdown(value: unknown): QuoteComplexityBreakdown | null {
  if (!value || typeof value !== 'object') {
    return null
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
    return null
  }

  return {
    features_scored: featuresScored,
    overhead_hours: overheadHours,
    total_hours_before_buffer: totalHoursBeforeBuffer,
    buffer_applied: bufferApplied,
    total_hours_final: totalHoursFinal,
  }
}

function sanitizeLineItems(value: unknown): QuoteLineItem[] | null {
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

  return items
}

function sanitizeDraftContent(value: unknown): QuoteDraftContent | null {
  if (!value || typeof value !== 'object') {
    return null
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
    return null
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const { id } = await params

  try {
    const quote = await getQuoteById(id, auth.supabase)

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    return NextResponse.json({ quote })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load quote' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}

  if (body.title !== undefined) {
    const title = sanitizeText(body.title)
    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    patch.title = title
  }

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !QUOTE_STATUSES.has(body.status as QuoteStatus)) {
      return NextResponse.json({ error: 'Invalid quote status' }, { status: 400 })
    }
    patch.status = body.status
  }

  if (body.pricing_type !== undefined) {
    if (
      typeof body.pricing_type !== 'string' ||
      !PRICING_TYPES.has(body.pricing_type as PricingType)
    ) {
      return NextResponse.json({ error: 'Invalid pricing type' }, { status: 400 })
    }
    patch.pricing_type = body.pricing_type
  }

  for (const key of [
    'account_id',
    'contact_id',
    'workstream_id',
    'project_id',
    'enquiry_id',
    'pricing_tier_id',
    'converted_invoice_id',
  ] as const) {
    if (body[key] !== undefined) {
      if (body[key] !== null && typeof body[key] !== 'string') {
        return NextResponse.json({ error: `${key} must be a string or null` }, { status: 400 })
      }
      patch[key] = body[key]
    }
  }

  if (body.summary !== undefined) patch.summary = sanitizeText(body.summary)
  if (body.estimated_hours !== undefined) {
    const estimatedHours = Number(body.estimated_hours)
    if (!Number.isFinite(estimatedHours)) {
      return NextResponse.json({ error: 'estimated_hours must be numeric' }, { status: 400 })
    }
    patch.estimated_hours = estimatedHours
  }
  if (body.estimated_timeline !== undefined) {
    patch.estimated_timeline = sanitizeText(body.estimated_timeline)
  }
  if (body.valid_until !== undefined) patch.valid_until = typeof body.valid_until === 'string' ? body.valid_until : null
  if (body.payment_terms !== undefined) patch.payment_terms = sanitizeText(body.payment_terms)
  if (body.notes !== undefined) patch.notes = sanitizeText(body.notes)
  if (body.version !== undefined) {
    const version = Number(body.version)
    if (!Number.isFinite(version) || version < 1) {
      return NextResponse.json({ error: 'version must be a positive integer' }, { status: 400 })
    }
    patch.version = version
  }
  if (body.generated_at !== undefined) patch.generated_at = typeof body.generated_at === 'string' ? body.generated_at : null
  if (body.sent_at !== undefined) patch.sent_at = typeof body.sent_at === 'string' ? body.sent_at : null
  if (body.created_by_id !== undefined) patch.created_by_id = typeof body.created_by_id === 'string' ? body.created_by_id : null
  if (body.ai_generated !== undefined) patch.ai_generated = body.ai_generated === true
  if (body.ai_generated_at !== undefined) patch.ai_generated_at = typeof body.ai_generated_at === 'string' ? body.ai_generated_at : null
  if (body.issue_date !== undefined) patch.issue_date = typeof body.issue_date === 'string' ? body.issue_date : null

  if (body.vat_rate !== undefined) {
    const vatRate = Number(body.vat_rate)
    if (!Number.isFinite(vatRate)) {
      return NextResponse.json({ error: 'vat_rate must be numeric' }, { status: 400 })
    }
    patch.vat_rate = vatRate
  }

  if (body.scope !== undefined) {
    const scope = sanitizeScope(body.scope)
    if (!scope) {
      return NextResponse.json({ error: 'scope must be an array' }, { status: 400 })
    }
    patch.scope = scope
  }

  if (body.complexity_breakdown !== undefined) {
    const complexityBreakdown = sanitizeComplexityBreakdown(body.complexity_breakdown)
    if (!complexityBreakdown) {
      return NextResponse.json(
        { error: 'complexity_breakdown must be a valid object' },
        { status: 400 }
      )
    }
    patch.complexity_breakdown = complexityBreakdown
  }

  if (body.line_items !== undefined) {
    const lineItems = sanitizeLineItems(body.line_items)
    if (!lineItems) {
      return NextResponse.json({ error: 'line_items must be an array' }, { status: 400 })
    }
    patch.line_items = lineItems
  }

  if (body.draft_content !== undefined) {
    const draftContent = sanitizeDraftContent(body.draft_content)
    if (!draftContent) {
      return NextResponse.json({ error: 'draft_content must be a valid quote content object' }, { status: 400 })
    }
    patch.draft_content = draftContent
  }

  if (body.final_content !== undefined) {
    const finalContent = sanitizeDraftContent(body.final_content)
    if (!finalContent) {
      return NextResponse.json({ error: 'final_content must be a valid quote content object' }, { status: 400 })
    }
    patch.final_content = finalContent
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
  }

  try {
    const existing = await getQuoteById(id, auth.supabase)
    if (!existing) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = await updateQuote(id, patch, auth.supabase)
    return NextResponse.json({ quote })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update quote' },
      { status: 500 }
    )
  }
}
