import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getEnquiryById } from '@/lib/db/enquiries'
import { createQuote, getQuoteById } from '@/lib/db/quotes'
import type { Contact, Quote, QuoteLineItem, QuoteScope } from '@/lib/types'

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1'

type AiQuoteResponse = {
  title: string
  summary: string
  pricing_type: 'fixed' | 'time_and_materials' | 'milestone'
  scope: QuoteScope[]
  line_items: QuoteLineItem[]
  vat_rate: 20
  payment_terms: string
  notes: string
  estimated_timeline: string
}

const SYSTEM_PROMPT = `You are an expert software development consultant and
project scoper working for Trailhead Holdings Ltd,
a UK-based consultancy specialising in bespoke web
applications, internal tools, and digital products.
Your job is to analyse a client discovery form submission
and produce:

A structured scope of work broken into clear phases
A priced quote with line items

Pricing guidelines (use these ranges):

Discovery & planning phase: £500–£2,000
UI/UX design: £1,000–£5,000 depending on complexity
Frontend development: £80–£120/hour
Backend development: £80–£120/hour
Database & infrastructure: £500–£2,500
Testing & QA: 10-15% of dev cost
Project management: 10% of total
Training & handover: £300–£800
Ongoing support (monthly): £200–£800/month

Base your estimate on:

Team size and complexity indicated
Features requested
Timeline required
Type of project (website vs web app vs mobile)
Industry (some industries need more compliance work)

Always respond with ONLY valid JSON matching this exact schema,
no markdown, no explanation:
{
"title": "string — project title based on their business and need",
"summary": "string — 2-3 sentence executive summary",
"pricing_type": "fixed|time_and_materials|milestone",
"scope": [
{
"phase": "string — phase name e.g. Discovery & Planning",
"description": "string — what happens in this phase",
"deliverables": ["string", "string"],
"duration": "string — e.g. 1 week"
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
"notes": "string — any assumptions or caveats",
"estimated_timeline": "string — total project duration"
}`

function buildUserPrompt(args: {
  enquiry: {
    biz_name: string
    contact_name: string
    contact_email: string | null
    biz_type: string | null
    project_type: string | null
    team_size: string | null
    team_split: string | null
    top_features: string[]
    calendar_detail: string | null
    forms_detail: string | null
    devices: string[]
    offline_capability: string | null
    existing_tools: string | null
    pain_points: string | null
    timeline: string | null
    budget: string | null
    extra: string | null
  }
}) {
  const { enquiry } = args

  return `Client discovery form submission:
Business: ${enquiry.biz_name}
Contact: ${enquiry.contact_name} (${enquiry.contact_email ?? 'No email provided'})
Business type: ${enquiry.biz_type ?? 'Not specified'}
Project type: ${enquiry.project_type ?? 'Not specified'}
Team size: ${enquiry.team_size ?? 'Not specified'}
Team split: ${enquiry.team_split ?? 'Not specified'}
Features requested: ${enquiry.top_features.join(', ')}
Current appointment management: ${enquiry.calendar_detail ?? 'Not specified'}
Forms currently used: ${enquiry.forms_detail ?? 'Not specified'}
Devices used: ${enquiry.devices.join(', ')}
Offline/signal requirements: ${enquiry.offline_capability ?? 'Not specified'}
Existing tools/integrations: ${enquiry.existing_tools ?? 'Not specified'}
Biggest pain point: ${enquiry.pain_points ?? 'Not specified'}
Timeline: ${enquiry.timeline ?? 'Not specified'}
Budget indication: ${enquiry.budget || 'Not specified'}
Additional info: ${enquiry.extra || 'None'}
Please generate a scope of work and quote for this project.`
}

function stripCodeFences(value: string) {
  return value.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
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
      const deliverables = Array.isArray(record.deliverables)
        ? record.deliverables
            .filter((entry): entry is string => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter(Boolean)
        : []

      if (!phase || !description || !duration) {
        return null
      }

      return { phase, description, deliverables, duration }
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

async function callOpenAI(system: string, user: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const openai = new OpenAI({ apiKey })
  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })

  const text = response.choices[0]?.message?.content ?? ''

  if (!text.trim()) {
    throw new Error('AI generation failed')
  }

  return text
}

function parseAiResponse(text: string): AiQuoteResponse {
  try {
    const parsed = JSON.parse(stripCodeFences(text)) as Record<string, unknown>

    return {
      title:
        typeof parsed.title === 'string' && parsed.title.trim()
          ? parsed.title.trim()
          : 'Draft quote',
      summary:
        typeof parsed.summary === 'string' && parsed.summary.trim()
          ? parsed.summary.trim()
          : 'AI-assisted draft summary.',
      pricing_type:
        parsed.pricing_type === 'time_and_materials' || parsed.pricing_type === 'milestone'
          ? parsed.pricing_type
          : 'fixed',
      scope: sanitizeScope(parsed.scope),
      line_items: sanitizeLineItems(parsed.line_items),
      vat_rate: 20,
      payment_terms:
        typeof parsed.payment_terms === 'string' && parsed.payment_terms.trim()
          ? parsed.payment_terms.trim()
          : 'Payment terms: 50% deposit on acceptance, 50% on completion.',
      notes:
        typeof parsed.notes === 'string' && parsed.notes.trim()
          ? parsed.notes.trim()
          : 'AI-generated draft quote.',
      estimated_timeline:
        typeof parsed.estimated_timeline === 'string' && parsed.estimated_timeline.trim()
          ? parsed.estimated_timeline.trim()
          : 'To be confirmed',
    }
  } catch {
    throw new Error('AI generation failed')
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const body = await request.json().catch(() => ({}))
  const enquiryId = typeof body.enquiry_id === 'string' ? body.enquiry_id : ''

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

    if (existingQuote?.id) {
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

    const [appDevWorkstreamResult, convertedContactResult] = await Promise.all([
      auth.supabase.from('workstreams').select('*').eq('slug', 'app-dev').maybeSingle(),
      enquiry.converted_contact_id
        ? auth.supabase.from('contacts').select('*').eq('id', enquiry.converted_contact_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (appDevWorkstreamResult.error) {
      throw new Error(appDevWorkstreamResult.error.message || 'Failed to load app-dev workstream')
    }

    if (convertedContactResult.error) {
      throw new Error(convertedContactResult.error.message || 'Failed to load converted contact')
    }

    const convertedContact = (convertedContactResult.data as Contact | null) ?? null
    const rawText = await callOpenAI(
      SYSTEM_PROMPT,
      buildUserPrompt({
        enquiry: {
          biz_name: enquiry.biz_name,
          contact_name: enquiry.contact_name,
          contact_email: enquiry.contact_email,
          biz_type: enquiry.biz_type,
          project_type: enquiry.project_type,
          team_size: enquiry.team_size,
          team_split: enquiry.team_split,
          top_features: enquiry.top_features,
          calendar_detail: enquiry.calendar_detail,
          forms_detail: enquiry.forms_detail,
          devices: enquiry.devices,
          offline_capability: enquiry.offline_capability,
          existing_tools: enquiry.existing_tools,
          pain_points: enquiry.pain_points,
          timeline: enquiry.timeline,
          budget: enquiry.budget,
          extra: enquiry.extra,
        },
      })
    )

    const aiResponse = parseAiResponse(rawText)
    const quote = await createQuote(
      {
        account_id: convertedContact?.account_id ?? undefined,
        contact_id: convertedContact?.id ?? undefined,
        workstream_id: appDevWorkstreamResult.data?.id ?? undefined,
        enquiry_id: enquiry.id,
        status: 'draft',
        pricing_type: aiResponse.pricing_type,
        title: aiResponse.title,
        summary: aiResponse.summary,
        scope: aiResponse.scope,
        line_items: aiResponse.line_items,
        vat_rate: 20,
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        payment_terms: aiResponse.payment_terms,
        notes: `${aiResponse.notes}\n\nEstimated timeline: ${aiResponse.estimated_timeline}`,
        converted_invoice_id: undefined,
        ai_generated: true,
        ai_generated_at: new Date().toISOString(),
        issue_date: new Date().toISOString().slice(0, 10),
      } satisfies Omit<Quote, 'id' | 'quote_number' | 'created_at' | 'updated_at'>,
      auth.supabase
    )

    return NextResponse.json({ quote_id: quote.id, quote })
  } catch (error) {
    if (error instanceof Error && error.message === 'AI generation failed') {
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate quote' },
      { status: 500 }
    )
  }
}
