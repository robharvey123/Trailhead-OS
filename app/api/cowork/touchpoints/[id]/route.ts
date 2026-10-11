import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { deleteCoworkTouchpoint } from '@/lib/cowork-touchpoints'
import { recordCoworkWrite } from '@/lib/cowork-audit'

// DELETE /api/cowork/touchpoints/[id] — permanent. The deleted row is kept on the
// activity log.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id } = await params
    const touchpoint = await deleteCoworkTouchpoint(id)
    const target = touchpoint.engagement?.name ?? touchpoint.account?.name ?? touchpoint.contact?.name
    void recordCoworkWrite({
      action: 'delete',
      entity: 'touchpoint',
      entityId: touchpoint.id,
      entityLabel: touchpoint.subject,
      engagementId: touchpoint.engagement?.id ?? null,
      summary: `Deleted ${touchpoint.type} touchpoint "${touchpoint.subject}"${target ? ` (${target})` : ''}`,
      payload: touchpoint,
    })
    return Response.json({ deleted: true })
  } catch (error) {
    return jsonError(error, 'Failed to delete touchpoint')
  }
}
