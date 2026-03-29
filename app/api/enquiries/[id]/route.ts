import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { getEnquiryById, updateEnquiry } from '@/lib/db/enquiries'
import type { Enquiry, EnquiryStatus } from '@/lib/types'

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
    const enquiry = await getEnquiryById(id, auth.supabase)

    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
    }

    return NextResponse.json({ enquiry })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load enquiry' },
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
  const patch: Partial<Enquiry> = {}

  if ('biz_name' in body) {
    const value = sanitizeText(body.biz_name)
    if (!value) {
      return NextResponse.json({ error: 'biz_name is required' }, { status: 400 })
    }
    patch.biz_name = value
  }

  if ('contact_name' in body) {
    const value = sanitizeText(body.contact_name)
    if (!value) {
      return NextResponse.json({ error: 'contact_name is required' }, { status: 400 })
    }
    patch.contact_name = value
  }

  if ('contact_email' in body) {
    const value = sanitizeText(body.contact_email)
    if (!value) {
      return NextResponse.json({ error: 'contact_email is required' }, { status: 400 })
    }

    if (!isValidEmail(value)) {
      return NextResponse.json(
        { error: 'contact_email must be a valid email address' },
        { status: 400 }
      )
    }

    patch.contact_email = value
  }

  if ('contact_phone' in body) {
    const value = sanitizeText(body.contact_phone)
    if (!value) {
      return NextResponse.json({ error: 'contact_phone is required' }, { status: 400 })
    }
    patch.contact_phone = value
  }

  if ('biz_type' in body) patch.biz_type = sanitizeText(body.biz_type)
  if ('project_type' in body) patch.project_type = sanitizeText(body.project_type)
  if ('team_size' in body) patch.team_size = sanitizeText(body.team_size)
  if ('team_split' in body) patch.team_split = sanitizeText(body.team_split)
  if ('top_features' in body) patch.top_features = sanitizeStringArray(body.top_features)
  if ('calendar_detail' in body) patch.calendar_detail = sanitizeText(body.calendar_detail)
  if ('forms_detail' in body) patch.forms_detail = sanitizeText(body.forms_detail)
  if ('devices' in body) patch.devices = sanitizeStringArray(body.devices)
  if ('offline_capability' in body) {
    patch.offline_capability = sanitizeText(body.offline_capability)
  }
  if ('existing_tools' in body) patch.existing_tools = sanitizeText(body.existing_tools)
  if ('pain_points' in body) patch.pain_points = sanitizeText(body.pain_points)
  if ('timeline' in body) patch.timeline = sanitizeText(body.timeline)
  if ('referral_source' in body) patch.referral_source = sanitizeText(body.referral_source)
  if ('budget' in body) patch.budget = sanitizeText(body.budget)
  if ('extra' in body) patch.extra = sanitizeText(body.extra)

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !ENQUIRY_STATUSES.has(body.status as EnquiryStatus)) {
      return NextResponse.json(
        { error: 'status must be new, reviewed, or converted' },
        { status: 400 }
      )
    }

    patch.status = body.status as EnquiryStatus
  }

  if (body.converted_contact_id !== undefined) {
    if (
      body.converted_contact_id !== null &&
      typeof body.converted_contact_id !== 'string'
    ) {
      return NextResponse.json(
        { error: 'converted_contact_id must be a string or null' },
        { status: 400 }
      )
    }

    patch.converted_contact_id =
      typeof body.converted_contact_id === 'string' && !body.converted_contact_id.trim()
        ? null
        : body.converted_contact_id
  }

  if (body.account_id !== undefined) {
    if (body.account_id !== null && typeof body.account_id !== 'string') {
      return NextResponse.json(
        { error: 'account_id must be a string or null' },
        { status: 400 }
      )
    }

    patch.account_id =
      typeof body.account_id === 'string' && !body.account_id.trim()
        ? null
        : body.account_id
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
  }

  try {
    const enquiry = await updateEnquiry(id, patch, auth.supabase)
    return NextResponse.json({ enquiry })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update enquiry' },
      { status: 500 }
    )
  }
}
