import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { getEngagementRow, listEngagementDocuments, uploadEngagementDocument } from '@/lib/cowork-engagements'
import { recordCoworkWrite } from '@/lib/cowork-audit'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id } = await params
    return Response.json(await listEngagementDocuments(id))
  } catch (error) {
    return jsonError(error, 'Failed to load documents')
  }
}

// POST — upload a document. JSON body: { file_name, content_base64 } for any file,
// or { file_name, content } for utf-8 text. Optional title, mime_type.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { document, engagement } = await uploadEngagementDocument(id, body)
    void recordCoworkWrite({
      action: 'create',
      entity: 'engagement_document',
      entityId: document.id,
      entityLabel: document.file_name,
      engagementId: engagement.id,
      summary: `Uploaded document "${document.title ?? document.file_name}" to ${engagement.name}`,
      payload: { file_name: document.file_name, mime_type: document.mime_type, size_bytes: document.size_bytes },
    })
    return Response.json(document, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to upload document')
  }
}
