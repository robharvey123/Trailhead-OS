import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { getMilestones } from '@/lib/cowork-engagements'

// GET — one row per tier-1 account: the three gate dates, is_complete, completed_at,
// performance_fee, and whether an invoice is attached.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { id } = await params
    return Response.json(await getMilestones(id))
  } catch (error) {
    return jsonError(error, 'Failed to load milestones')
  }
}
