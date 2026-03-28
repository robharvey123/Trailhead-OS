import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { getEnquiryById, updateEnquiry } from '@/lib/db/enquiries'
import type { EnquiryStatus } from '@/lib/types'

const ENQUIRY_STATUSES = new Set<EnquiryStatus>(['new', 'reviewed', 'converted'])

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
  const patch: { status?: EnquiryStatus; converted_contact_id?: string | null } = {}

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

    patch.converted_contact_id = body.converted_contact_id
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
