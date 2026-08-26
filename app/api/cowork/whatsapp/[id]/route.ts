import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { patchMessage } from '@/lib/cowork-whatsapp'

// PATCH /api/cowork/whatsapp/[id] — body, is_draft, client_visible, occurred_at,
// occurred_at_precision. {"is_draft": false} promotes a drafted reply to sent
// once Rob confirms; a body change at the same time recomputes wa_message_id.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { message, before } = await patchMessage(id, body)
    const what = before.is_draft && !message.is_draft ? 'Confirmed sent' : 'Amended'
    void recordCoworkWrite({
      action: 'update',
      entity: 'whatsapp_message',
      entityId: message.id,
      entityLabel: message.display_name ?? 'WhatsApp',
      engagementId: message.engagement_id,
      summary: `${what} WhatsApp message from ${message.display_name ?? 'unknown'}: "${(message.body ?? '').slice(0, 80)}"`,
      payload: body,
      before,
    })
    return Response.json(message)
  } catch (error) {
    return jsonError(error, 'Failed to update WhatsApp message')
  }
}
