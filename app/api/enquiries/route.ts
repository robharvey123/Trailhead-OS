import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { getApiKeyAuth } from '@/lib/api/auth'
import { DEFAULT_RESEND_FROM, resend } from '@/lib/email/resend'
import { newEnquiryEmail } from '@/lib/email/templates/new-enquiry'
import type { Enquiry, EnquiryStatus } from '@/lib/types'
import { getEnquiries } from '@/lib/db/enquiries'

const ENQUIRY_STATUSES = new Set<EnquiryStatus>([
  'new',
  'reviewed',
  'converted',
  'received',
  'under_review',
  'quoted',
  'closed',
])

// Reject anything larger than this before doing any parsing work.
const MAX_BODY_BYTES = 50_000
// Newly-created enquiries allowed per rolling hour before the endpoint 429s.
const HOURLY_ENQUIRY_LIMIT = 20

// Per-field caps so a bot can't stuff megabytes into a text column.
const MAX_NAME = 200
const MAX_SHORT = 200
const MAX_PHONE = 50
const MAX_TEXTAREA = 2_000
const MAX_ARRAY_ITEMS = 50

function cappedText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function cappedStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, MAX_SHORT))
    .filter(Boolean)
    .slice(0, MAX_ARRAY_ITEMS)
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Build an enquiry insert from an explicit whitelist of PUBLIC form fields only.
 * Internal CRM fields (account_id, project_id, internal_notes*, converted_contact_id)
 * are never accepted here — they are settable solely via the authenticated PATCH
 * path. status is forced to 'new'; the caller cannot set it.
 */
function mapPublicEnquiryPayload(body: Record<string, unknown>): Omit<Enquiry, 'id' | 'created_at'> {
  return {
    biz_name: cappedText(body.biz_name, MAX_NAME) ?? '',
    contact_name: cappedText(body.contact_name, MAX_NAME) ?? '',
    contact_email: cappedText(body.contact_email, MAX_SHORT),
    contact_phone: cappedText(body.contact_phone, MAX_PHONE),
    biz_type: cappedText(body.biz_type, MAX_SHORT),
    project_type: cappedText(body.project_type, MAX_SHORT),
    team_size: cappedText(body.team_size, MAX_SHORT),
    team_split: cappedText(body.team_split, MAX_SHORT),
    top_features: cappedStringArray(body.top_features),
    calendar_detail: cappedText(body.calendar_detail, MAX_TEXTAREA),
    forms_detail: cappedText(body.forms_detail, MAX_TEXTAREA),
    devices: cappedStringArray(body.devices),
    offline_capability: cappedText(body.offline_capability, MAX_SHORT),
    existing_tools: cappedText(body.existing_tools, MAX_TEXTAREA),
    pain_points: cappedText(body.pain_points, MAX_TEXTAREA),
    timeline: cappedText(body.timeline, MAX_SHORT),
    referral_source: cappedText(body.referral_source, MAX_SHORT),
    budget: cappedText(body.budget, MAX_SHORT),
    extra: cappedText(body.extra, MAX_TEXTAREA),
    status: 'new',
    account_id: null,
    project_id: null,
    internal_notes: null,
    internal_notes_updated_at: null,
    internal_notes_author_id: null,
    converted_contact_id: null,
  }
}

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
    return { supabase, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return { supabase, response: null }
}

export async function GET(request: Request) {
  const auth = await getAuthenticatedSupabase()
  if (auth.response) {
    return auth.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const enquiries = await getEnquiries(
      {
        status:
          status && ENQUIRY_STATUSES.has(status as EnquiryStatus)
            ? status as EnquiryStatus
            : undefined,
        account_id: searchParams.get('account_id') ?? undefined,
        project_id: searchParams.get('project_id') ?? undefined,
      },
      auth.supabase
    )

    return NextResponse.json({ enquiries })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load enquiries' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  // Reject oversized bodies before doing any parsing work.
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    body = {}
  }

  // Honeypot: a real user never fills the hidden `website` field. If it's
  // populated, pretend success and insert nothing — no signal to the bot.
  if (cappedText(body.website, MAX_SHORT)) {
    return NextResponse.json({ id: crypto.randomUUID() }, { status: 201 })
  }

  // Public endpoint runs as the anon role — the "public can insert enquiries"
  // RLS policy is the authorisation boundary, not a service-role key.
  const supabase = await createSupabaseClient()

  // Rolling hourly cap. anon can't SELECT enquiries, so a SECURITY DEFINER
  // function returns the count without exposing any row data.
  const { data: recentCount, error: countError } = await supabase.rpc('count_recent_enquiries')
  if (!countError && typeof recentCount === 'number' && recentCount >= HOURLY_ENQUIRY_LIMIT) {
    return NextResponse.json({ error: 'Too many requests, please try again later' }, { status: 429 })
  }

  const payload = mapPublicEnquiryPayload(body)

  if (!payload.biz_name || !payload.contact_name || !payload.contact_email || !payload.contact_phone) {
    return NextResponse.json(
      { error: 'biz_name, contact_name, contact_email, and contact_phone are required' },
      { status: 400 }
    )
  }

  if (!isValidEmail(payload.contact_email)) {
    return NextResponse.json(
      { error: 'contact_email must be a valid email address' },
      { status: 400 }
    )
  }

  // Generate the id client-side so we don't need a RETURNING select (anon has
  // no SELECT policy on enquiries).
  const id = crypto.randomUUID()
  const { error } = await supabase.from('enquiries').insert({ id, ...payload })

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to create enquiry' },
      { status: 500 }
    )
  }

  try {
    const notificationEmail = process.env.NOTIFICATION_EMAIL
    if (notificationEmail && resend) {
      const email = newEnquiryEmail({ ...payload, id, created_at: new Date().toISOString() } as Enquiry)
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_RESEND_FROM,
        to: [notificationEmail],
        subject: email.subject,
        html: email.html,
      })
    } else {
      console.warn('Skipping enquiry notification email because notification env vars are missing')
    }
  } catch (emailError) {
    console.error('Failed to send enquiry notification email', emailError)
  }

  return NextResponse.json({ id }, { status: 201 })
}
