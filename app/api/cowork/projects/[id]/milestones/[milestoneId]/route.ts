import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { updateProjectMilestone } from '@/lib/cowork-projects'

/**
 * PATCH /api/cowork/projects/[id]/milestones/[milestoneId]
 * Body: { completed?: boolean, date?: string, name?: string }.
 * Flipping `completed` stamps/clears `completed_at`. Returns the milestone.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id, milestoneId } = await params
    const body = await request.json().catch(() => ({}))
    const milestone = await updateProjectMilestone(id, milestoneId, body)
    return Response.json(milestone)
  } catch (error) {
    return jsonError(error, 'Failed to update milestone')
  }
}
