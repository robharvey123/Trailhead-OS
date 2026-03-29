import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getEnquiryById } from '@/lib/db/enquiries'
import { getPricingTierById } from '@/lib/db/pricing-tiers'
import { createQuote, getQuoteById, updateQuote } from '@/lib/db/quotes'
import { getWorkstreamBySlug } from '@/lib/db/workstreams'
import type {
  Enquiry,
  PricingTier,
  Quote,
  QuoteComplexityBreakdown,
  QuoteLineItem,
  QuoteScope,
} from '@/lib/types'

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'
const QUOTE_VALIDITY_DAYS = 30

type EnquiryPrompt = Pick<
  Enquiry,
  | 'biz_name'
  | 'contact_name'
  | 'top_features'
  | 'forms_detail'
  | 'devices'
  | 'budget'
  | 'extra'
> & {
  contact_email: string
  biz_type: string
  project_type: string
  team_size: string
  team_split: string
  calendar_detail: string
  offline_capability: string
  existing_tools: string
  pain_points: string
  timeline: string
}

type AiQuoteResponse = {
  title: string
  summary: string
  pricing_type: 'fixed' | 'time_and_materials' | 'milestone'
  estimated_hours: number
  estimated_timeline: string
  scope: QuoteScope[]
  line_items: QuoteLineItem[]
  vat_rate: 20
  payment_terms: string
  notes: string
  complexity_breakdown: QuoteComplexityBreakdown
}

const BASE_SYSTEM_PROMPT = `You are an expert software development consultant and project
scoper working for Trailhead Holdings Ltd, a UK-based
consultancy specialising in bespoke web applications, internal
tools, and digital products.

IMPORTANT CONTEXT - AI-ASSISTED DEVELOPMENT:
Rob uses AI coding tools (Claude, ChatGPT, GitHub Copilot)
extensively. Development velocity is 2-3x faster than
traditional development. Adjust all time estimates accordingly -
a feature that would take a traditional developer 3 days takes
Rob approximately 1 day.

ESTIMATION METHODOLOGY:
Use feature-point scoring to estimate hours.

COMPLEXITY SCORES (hours of dev time, AI-adjusted):

Simple features (2-4 hrs each):
- Static pages / content pages
- Simple forms with email notification
- Basic CRUD (list + detail view)
- Styling and responsive layout work
- Simple API integration (read-only)

Medium features (6-12 hrs each):
- Authentication system (login, register, reset)
- Dashboard with charts and analytics
- File upload and storage
- Payment integration (Stripe etc)
- Two-way API integration
- Search and filtering
- Email automation sequences
- User roles and permissions (basic)

Complex features (16-24 hrs each):
- Multi-tenant architecture
- Real-time features (websockets, live updates)
- Complex workflow automation
- Custom reporting engine
- Third-party sync (bidirectional)
- Mobile app (React Native)
- Complex permissions system
- AI/ML integration

OVERHEAD MULTIPLIERS (apply to total feature hours):
- Discovery & planning: add 15% of total dev hours
- UI/UX design: add 20% of total dev hours
- Testing & QA: add 15% of total dev hours
- Project management: add 10% of total dev hours
- Deployment & infrastructure: add 8-16 hrs flat
- Client review cycles (assume 2 rounds): add 8 hrs flat
- Handover & training: add 4-8 hrs flat

FIXED FEE CALCULATION:
1. Estimate total hours using the above scoring
2. Multiply by the hourly rate for the tier
3. Apply the tier fixed fee margin on top
4. Add 15% contingency buffer (bake into prices silently,
   do not show as a line item)
5. Round to nearest GBP 50 for cleaner numbers
6. Split across phases for milestone pricing

TEAM SIZE ADJUSTMENTS:
- 1-5 people: assume simple features only
- 6-15 people: assume medium complexity
- 16-30 people: medium-complex, likely needs permissions,
  reporting, integrations
- 30+ people: complex, likely needs audit trails,
  advanced permissions, performance optimisation

PROJECT TYPE ADJUSTMENTS:
- Website (marketing/brochure): 20-60 hrs total
  Focus: design quality, CMS, contact forms
- Web application (internal tool): 40-200 hrs
  Focus: data model, workflows, user management
- Web application (client-facing): 60-300 hrs
  Add auth, permissions, billing if SaaS
- Mobile app: multiply web estimate by 1.5
  Add 8 hrs flat for app store submission
- Integration/automation: 20-80 hrs

TIMELINE CALCULATION:
Rob works approximately 4 hrs/day on any single project
alongside other workstreams.
Total days = total hours / 4
Add 20% buffer for revisions and unexpected complexity.
Round up to nearest week.

PHASE STRUCTURE - always use these phases in order:
1. Discovery & Planning (always first)
2. Design & Prototyping (if UI-heavy)
3. Core Development
4. Integrations (if third-party systems involved)
5. Testing & Refinement
6. Launch & Handover
7. Support & Maintenance (monthly, ongoing - always include)

PRICING RULES:
- Never quote below GBP 1,500 for any project
- Always include a monthly hosting/maintenance line item
- For time & materials: quote a realistic hours range
- For fixed price: 15% contingency baked in silently
- Payment terms: 50% upfront, 50% on completion
- Projects over GBP 10,000: suggest milestone payments

INDUSTRY CONSIDERATIONS:
- Healthcare/medical: add 20% for compliance
- Finance/fintech: add 20% for security requirements
- Retail/e-commerce: include Stripe integration as standard
- Multi-location: add complexity for data isolation
- Regulated industries: add GDPR/data audit trail work

Respond ONLY with valid JSON. No markdown, no explanation
outside the JSON. Use this exact schema:
{
  "title": "string - project title based on business and need",
  "summary": "string - 2-3 sentences mentioning estimated timeline",
  "pricing_type": "fixed|time_and_materials|milestone",
  "estimated_hours": number,
  "estimated_timeline": "string e.g. 6-8 weeks",
  "scope": [
    {
      "phase": "string - phase name",
      "description": "string - what happens in this phase",
      "deliverables": ["string"],
      "duration": "string e.g. 1 week",
      "estimated_hours": number
    }
  ],
  "line_items": [
    {
      "id": "uuid string",
      "description": "string",
      "qty": number,
      "unit_price": number,
      "type": "fixed|hourly|milestone"
    }
  ],
  "vat_rate": 20,
  "payment_terms": "string",
  "notes": "string - key assumptions made",
  "complexity_breakdown": {
    "features_scored": ["string - feature name: X hrs"],
    "overhead_hours": number,
    "total_hours_before_buffer": number,
    "buffer_applied": "15%",
    "total_hours_final": number
  }
}`

function buildTierPrompt(tier: PricingTier) {
  return `

Use these exact rates for this quote. Do not deviate from them:
- Hourly development rate: GBP ${tier.hourly_rate}/hour
- Day rate: GBP ${tier.day_rate}/day
- Monthly retainer: GBP ${tier.monthly_retainer}/month
- Hosting & maintenance: GBP ${tier.hosting_maintenance}/month
- For fixed-price items: apply a ${tier.fixed_fee_margin}%
  margin on top of your estimated base cost`
}

function buildUserPrompt(args: { enquiry: EnquiryPrompt }) {
  const { enquiry } = args

  return `Client discovery form submission:

Business: ${enquiry.biz_name}
Contact: ${enquiry.contact_name} (${enquiry.contact_email})
Business type: ${enquiry.biz_type}
Project type: ${enquiry.project_type}
Team size: ${enquiry.team_size}
Team split: ${enquiry.team_split}

Features requested: ${enquiry.top_features.join(', ')}
Current appointment/scheduling: ${enquiry.calendar_detail}
Forms currently used: ${enquiry.forms_detail}
Devices used: ${enquiry.devices.join(', ')}
Offline/signal requirements: ${enquiry.offline_capability}
Existing tools and integrations needed: ${enquiry.existing_tools}
Biggest pain point to solve: ${enquiry.pain_points}
Desired timeline: ${enquiry.timeline}
Budget indication: ${enquiry.budget || 'Not specified'}
Additional information: ${enquiry.extra || 'None'}

Please analyse this and generate a detailed scope of work
and accurate quote using your estimation methodology.`
}

function stripCodeFences(value: string) {
  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
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
      const phase = typeof record.phase === 'string' ? record.phase.trim() : ''
      const description = typeof record.description === 'string' ? record.description.trim() : ''
      const duration = typeof record.duration === 'string' ? record.duration.trim() : ''
      const estimatedHours = Number(record.estimated_hours)
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
        estimated_hours: Number.isFinite(estimatedHours) ? estimatedHours : undefined,
      }

      return scopeItem
    })
    .filter((item): item is QuoteScope => item !== null)
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
      const description = typeof record.description === 'string' ? record.description.trim() : ''
      const qty = Number(record.qty)
      const unitPrice = Number(record.unit_price)
      const type =
        record.type === 'fixed' || record.type === 'hourly' || record.type === 'milestone'
          ? record.type
          : 'fixed'

      if (!description || !Number.isFinite(qty) || !Number.isFinite(unitPrice)) {
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

function sanitizeComplexityBreakdown(value: unknown): QuoteComplexityBreakdown {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
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

  return {
    features_scored: featuresScored,
    overhead_hours: Number.isFinite(overheadHours) ? overheadHours : 0,
    total_hours_before_buffer: Number.isFinite(totalHoursBeforeBuffer)
      ? totalHoursBeforeBuffer
      : 0,
    buffer_applied: bufferApplied,
    total_hours_final: Number.isFinite(totalHoursFinal) ? totalHoursFinal : 0,
  }
}

function enforceHostingLineItem(
  lineItems: QuoteLineItem[],
  pricingType: AiQuoteResponse['pricing_type'],
  tier?: PricingTier | null
): QuoteLineItem[] {
  const hasHostingLine = lineItems.some((item) => /hosting|maintenance/i.test(item.description))

  if (hasHostingLine) {
    return lineItems.map((item): QuoteLineItem => {
      if (!/hosting|maintenance/i.test(item.description) || !tier) {
        return item
      }

      return {
        ...item,
        qty: item.qty || 1,
        unit_price: tier.hosting_maintenance,
        type: 'fixed',
      }
    })
  }

  return [
    ...lineItems,
    {
      id: crypto.randomUUID(),
      description: 'Hosting & maintenance (monthly)',
      qty: 1,
      unit_price: tier?.hosting_maintenance ?? 0,
      type: pricingType === 'milestone' ? 'fixed' : 'fixed',
    },
  ]
}

async function callAnthropic(system: string, user: string) {
  // Note for Rob: add ANTHROPIC_API_KEY to .env.local and Netlify environment variables.
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4000,
      system,
      messages: [
        {
          role: 'user',
          content: user,
        },
      ],
    }),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      payload.error &&
      typeof payload.error === 'object' &&
      'message' in payload.error &&
      typeof payload.error.message === 'string'
        ? payload.error.message
        : 'Anthropic API request failed'

    throw new Error(message)
  }

  const text =
    payload &&
    typeof payload === 'object' &&
    'content' in payload &&
    Array.isArray(payload.content)
      ? payload.content
          .filter(
            (entry: unknown): entry is { type: string; text: string } =>
              !!entry &&
              typeof entry === 'object' &&
              'type' in entry &&
              entry.type === 'text' &&
              'text' in entry &&
              typeof entry.text === 'string'
          )
          .map((entry: { type: string; text: string }) => entry.text)
          .join('\n')
          .trim()
      : ''

  if (!text) {
    throw new Error('Anthropic returned an empty response')
  }

  return text
}

function parseAiResponse(text: string, tier?: PricingTier | null): AiQuoteResponse {
  try {
    const parsed = JSON.parse(stripCodeFences(text)) as Record<string, unknown>
    const scope = sanitizeScope(parsed.scope)
    const complexityBreakdown = sanitizeComplexityBreakdown(parsed.complexity_breakdown)
    const estimatedHours = Number(parsed.estimated_hours)
    const pricingType =
      parsed.pricing_type === 'time_and_materials' || parsed.pricing_type === 'milestone'
        ? parsed.pricing_type
        : 'fixed'
    const lineItems = enforceHostingLineItem(sanitizeLineItems(parsed.line_items), pricingType, tier)

    return {
      title:
        typeof parsed.title === 'string' && parsed.title.trim()
          ? parsed.title.trim()
          : 'Draft quote',
      summary:
        typeof parsed.summary === 'string' && parsed.summary.trim()
          ? parsed.summary.trim()
          : 'AI-assisted draft summary.',
      pricing_type: pricingType,
      estimated_hours: Number.isFinite(estimatedHours)
        ? estimatedHours
        : complexityBreakdown.total_hours_final || scope.reduce(
            (total, phase) => total + (phase.estimated_hours ?? 0),
            0
          ),
      estimated_timeline:
        typeof parsed.estimated_timeline === 'string' && parsed.estimated_timeline.trim()
          ? parsed.estimated_timeline.trim()
          : 'To be confirmed',
      scope,
      line_items: lineItems,
      vat_rate: 20,
      payment_terms:
        typeof parsed.payment_terms === 'string' && parsed.payment_terms.trim()
          ? parsed.payment_terms.trim()
          : 'Payment terms: 50% upfront, 50% on completion.',
      notes:
        typeof parsed.notes === 'string' && parsed.notes.trim()
          ? parsed.notes.trim()
          : 'AI-generated draft quote.',
      complexity_breakdown: complexityBreakdown,
    }
  } catch {
    throw new Error('Failed to parse Anthropic JSON response')
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const body = await request.json().catch(() => ({}))
  const enquiryId = typeof body.enquiry_id === 'string' ? body.enquiry_id : ''
  const quoteId =
    typeof body.quote_id === 'string' && body.quote_id.trim()
      ? body.quote_id
      : undefined
  const pricingTierId =
    typeof body.pricing_tier_id === 'string' && body.pricing_tier_id.trim()
      ? body.pricing_tier_id
      : undefined
  const forceRegenerate = body.force_regenerate === true

  if (!enquiryId) {
    return NextResponse.json({ error: 'enquiry_id is required' }, { status: 400 })
  }

  try {
    const { data: existingQuote } = await auth.supabase
      .from('quotes')
      .select('id')
      .eq('enquiry_id', enquiryId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingQuote?.id && !quoteId && !forceRegenerate) {
      const quote = await getQuoteById(existingQuote.id, auth.supabase)

      if (!quote) {
        return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
      }

      return NextResponse.json({ quote_id: quote.id, quote })
    }

    const enquiry = await getEnquiryById(enquiryId, auth.supabase)
    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
    }

    const targetQuoteId = quoteId ?? (forceRegenerate ? existingQuote?.id : undefined)
    const existingQuoteRecord = targetQuoteId
      ? await getQuoteById(targetQuoteId, auth.supabase)
      : null

    if (targetQuoteId && !existingQuoteRecord) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (existingQuoteRecord?.enquiry_id && existingQuoteRecord.enquiry_id !== enquiry.id) {
      return NextResponse.json(
        { error: 'Quote does not belong to the supplied enquiry' },
        { status: 400 }
      )
    }

    const tierIdToUse = pricingTierId ?? existingQuoteRecord?.pricing_tier_id ?? undefined
    const [pricingTier, appDevWorkstream] = await Promise.all([
      tierIdToUse ? getPricingTierById(tierIdToUse, auth.supabase) : Promise.resolve(null),
      getWorkstreamBySlug('app-dev', auth.supabase),
    ])

    if (tierIdToUse && !pricingTier) {
      return NextResponse.json({ error: 'Pricing tier not found' }, { status: 404 })
    }

    if (!appDevWorkstream) {
      return NextResponse.json({ error: 'App development workstream not found' }, { status: 500 })
    }

    const rawText = await callAnthropic(
      `${BASE_SYSTEM_PROMPT}${pricingTier ? buildTierPrompt(pricingTier) : ''}`,
      buildUserPrompt({
        enquiry: {
          ...enquiry,
          contact_email: enquiry.contact_email ?? 'Not specified',
          biz_type: enquiry.biz_type ?? 'Not specified',
          project_type: enquiry.project_type ?? 'Not specified',
          team_size: enquiry.team_size ?? 'Not specified',
          team_split: enquiry.team_split ?? 'Not specified',
          calendar_detail: enquiry.calendar_detail ?? 'Not specified',
          forms_detail: enquiry.forms_detail ?? 'Not specified',
          devices: enquiry.devices?.length ? enquiry.devices : ['Not specified'],
          offline_capability: enquiry.offline_capability ?? 'Not specified',
          existing_tools: enquiry.existing_tools ?? 'Not specified',
          pain_points: enquiry.pain_points ?? 'Not specified',
          timeline: enquiry.timeline ?? 'Not specified',
        },
      })
    )

    let aiResponse: AiQuoteResponse
    try {
      aiResponse = parseAiResponse(rawText, pricingTier)
    } catch (parseError) {
      return NextResponse.json(
        { error: parseError instanceof Error ? parseError.message : 'Failed to parse AI quote' },
        { status: 500 }
      )
    }

    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + QUOTE_VALIDITY_DAYS)
    const generatedAt = new Date().toISOString()
    const quotePayload = {
      account_id: existingQuoteRecord?.account_id ?? enquiry.account_id ?? undefined,
      contact_id: existingQuoteRecord?.contact_id ?? undefined,
      workstream_id: existingQuoteRecord?.workstream_id ?? appDevWorkstream.id,
      enquiry_id: enquiry.id,
      pricing_tier_id: pricingTier?.id ?? existingQuoteRecord?.pricing_tier_id ?? undefined,
      status: existingQuoteRecord?.status ?? 'draft',
      pricing_type: aiResponse.pricing_type,
      title: aiResponse.title,
      summary: aiResponse.summary,
      estimated_hours: aiResponse.estimated_hours,
      estimated_timeline: aiResponse.estimated_timeline,
      scope: aiResponse.scope,
      line_items: aiResponse.line_items,
      vat_rate: aiResponse.vat_rate,
      valid_until: validUntil.toISOString().slice(0, 10),
      payment_terms: aiResponse.payment_terms,
      notes: aiResponse.notes,
      complexity_breakdown: aiResponse.complexity_breakdown,
      converted_invoice_id: existingQuoteRecord?.converted_invoice_id ?? undefined,
      ai_generated: true,
      ai_generated_at: generatedAt,
      issue_date: new Date().toISOString().slice(0, 10),
    } satisfies Omit<Quote, 'id' | 'quote_number' | 'created_at' | 'updated_at'>

    const quote = existingQuoteRecord
      ? await updateQuote(existingQuoteRecord.id, quotePayload, auth.supabase)
      : await createQuote(quotePayload, auth.supabase)

    return NextResponse.json(
      { quote_id: quote.id, quote },
      { status: existingQuoteRecord ? 200 : 201 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate AI quote' },
      { status: 500 }
    )
  }
}
