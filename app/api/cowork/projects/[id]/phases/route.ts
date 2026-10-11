import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { createProjectPhase } from '@/lib/cowork-projects'

/**
 * POST /api/cowork/projects/[id]/phases
 * Body: { name, description?, sort_order?, start_date?, end_date? }.
 * Appends after the last phase unless sort_order is sent.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const phase = await createProjectPhase(id, body)
    return Response.json(phase, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create phase')
  }
}
