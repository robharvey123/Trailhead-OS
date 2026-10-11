import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { deleteProjectPhase, updateProjectPhase } from '@/lib/cowork-projects'

/**
 * PATCH /api/cowork/projects/[id]/phases/[phaseId]
 * Body: { name?, description?, sort_order?, start_date?, end_date? }.
 * The AI planner sets phase dates weeks out — this is the correction path.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id, phaseId } = await params
    const body = await request.json().catch(() => ({}))
    const phase = await updateProjectPhase(id, phaseId, body)
    return Response.json(phase)
  } catch (error) {
    return jsonError(error, 'Failed to update phase')
  }
}

/** DELETE /api/cowork/projects/[id]/phases/[phaseId] */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id, phaseId } = await params
    return Response.json(await deleteProjectPhase(id, phaseId))
  } catch (error) {
    return jsonError(error, 'Failed to delete phase')
  }
}
