import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { getEngagementDetail, updateEngagement } from '@/lib/cowork-engagements'
import { recordCoworkWrite } from '@/lib/cowork-audit'

// The [id] segment accepts the engagement code (e.g. QOLA-UKEU-26) as well as the
// uuid — Claude usually has the code, not the uuid.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { id } = await params
    return Response.json(await getEngagementDetail(id))
  } catch (error) {
    return jsonError(error, 'Failed to load engagement')
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const engagement = await updateEngagement(id, body)
    void recordCoworkWrite({
      action: 'update',
      entity: 'engagement',
      entityId: engagement.id,
      entityLabel: engagement.code ?? engagement.name,
      engagementId: engagement.id,
      summary: `Updated engagement "${engagement.name}" (${Object.keys(body).join(', ')})`,
      payload: body,
    })
    return Response.json(engagement)
  } catch (error) {
    return jsonError(error, 'Failed to update engagement')
  }
}
