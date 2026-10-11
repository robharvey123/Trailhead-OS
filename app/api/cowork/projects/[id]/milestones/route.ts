import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { createProjectMilestone } from '@/lib/cowork-projects'

/**
 * POST /api/cowork/projects/[id]/milestones
 * Body: { name, date, description?, completed? }.
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
    const milestone = await createProjectMilestone(id, body)
    return Response.json(milestone, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create milestone')
  }
}
