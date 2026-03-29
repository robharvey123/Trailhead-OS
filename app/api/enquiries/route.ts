import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { DEFAULT_RESEND_FROM, resend } from '@/lib/email/resend'
import { newEnquiryEmail } from '@/lib/email/templates/new-enquiry'
import type { Enquiry, EnquiryFormState, EnquiryStatus } from '@/lib/types'
import { getEnquiries } from '@/lib/db/enquiries'

const ENQUIRY_STATUSES = new Set<EnquiryStatus>(['new', 'reviewed', 'converted'])

function sanitizeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function mapEnquiryPayload(body: Record<string, unknown>): Omit<Enquiry, 'id' | 'created_at'> {
  const statusValue = typeof body.status === 'string' ? body.status : 'new'
  const status = ENQUIRY_STATUSES.has(statusValue as EnquiryStatus)
    ? statusValue as EnquiryStatus
    : 'new'

  return {
    biz_name: sanitizeText(body.biz_name) ?? '',
    contact_name: sanitizeText(body.contact_name) ?? '',
    contact_email: sanitizeText(body.contact_email),
    contact_phone: sanitizeText(body.contact_phone),
    biz_type: sanitizeText(body.biz_type),
    project_type: sanitizeText(body.project_type),
    team_size: sanitizeText(body.team_size),
    team_split: sanitizeText(body.team_split),
    top_features: sanitizeStringArray(body.top_features),
    calendar_detail: sanitizeText(body.calendar_detail),
    forms_detail: sanitizeText(body.forms_detail),
    devices: sanitizeStringArray(body.devices),
    offline_capability: sanitizeText(body.offline_capability),
    existing_tools: sanitizeText(body.existing_tools),
    pain_points: sanitizeText(body.pain_points),
    timeline: sanitizeText(body.timeline),
    referral_source: sanitizeText(body.referral_source),
    budget: sanitizeText(body.budget),
    extra: sanitizeText(body.extra),
    status,
    converted_contact_id:
      body.converted_contact_id === null || body.converted_contact_id === undefined
        ? null
        : typeof body.converted_contact_id === 'string'
          ? body.converted_contact_id
          : null,
  }
}

async function getAuthenticatedSupabase() {
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
  const body = await request.json().catch(() => ({})) as Partial<EnquiryFormState>
  const admin = createAdminClient()
  const payload = mapEnquiryPayload(body as Record<string, unknown>)

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

  const { data, error } = await admin
    .from('enquiries')
    .insert(payload)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create enquiry' },
      { status: 500 }
    )
  }

  try {
    const notificationEmail = process.env.NOTIFICATION_EMAIL
    if (notificationEmail && resend) {
      const email = newEnquiryEmail(data as Enquiry)
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

  return NextResponse.json({ id: data.id }, { status: 201 })
}
