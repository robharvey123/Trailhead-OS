import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { deleteEngagementDocument } from '@/lib/cowork-engagements'
import { recordCoworkWrite } from '@/lib/cowork-audit'

// DELETE — permanently remove a document and its stored file. The engagement takes
// its code (e.g. QOLA-UKEU-26) or uuid.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id, docId } = await params
    const { document, engagement } = await deleteEngagementDocument(id, docId)
    void recordCoworkWrite({
      action: 'delete',
      entity: 'engagement_document',
      entityId: document.id,
      entityLabel: document.file_name,
      engagementId: engagement.id,
      summary: `Deleted document "${document.title ?? document.file_name ?? document.id}" from ${engagement.name}`,
      payload: document,
    })
    return Response.json({ deleted: true })
  } catch (error) {
    return jsonError(error, 'Failed to delete document')
  }
}
