import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { getCoworkEnquiry, updateCoworkEnquiry } from '@/lib/cowork-enquiries'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { id } = await params
    return Response.json(await getCoworkEnquiry(id))
  } catch (error) {
    return jsonError(error, 'Failed to load enquiry')
  }
}

// PATCH — status, internal_notes (stamps updated_at + author), converted_contact_id
// (must be an existing contact, or null).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    return Response.json(await updateCoworkEnquiry(id, body))
  } catch (error) {
    return jsonError(error, 'Failed to update enquiry')
  }
}
