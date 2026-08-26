import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError, parseBooleanParam, parseLimit } from '@/lib/cowork-api'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { captureMessages, listCoworkMessages } from '@/lib/cowork-whatsapp'

// GET /api/cowork/whatsapp — conversation_id, contact_id, account_id, engagement_id,
// since, limit (default 50, cap 200), include_drafts (default false: the morning
// brief and report generation never see an unsent draft unless they ask).
export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const sp = request.nextUrl.searchParams
    const since = sp.get('since')
    if (since && Number.isNaN(new Date(since).getTime())) return Response.json({ error: 'since must be an ISO datetime' }, { status: 400 })
    return Response.json(
      await listCoworkMessages({
        conversationId: sp.get('conversation_id') ?? undefined,
        contactId: sp.get('contact_id') ?? undefined,
        accountId: sp.get('account_id') ?? undefined,
        engagementId: sp.get('engagement_id') ?? undefined,
        since: since ? new Date(since).toISOString() : undefined,
        limit: parseLimit(sp.get('limit'), 50, 200),
        includeDrafts: parseBooleanParam(sp.get('include_drafts')) === true,
      })
    )
  } catch (error) {
    return jsonError(error, 'Failed to load WhatsApp messages')
  }
}

// POST — live capture. One object or an array (max 100). Every item is resolved
// before anything is written: an ambiguous title or an unknown sender is a 409
// with nothing inserted. Re-logging an identical message is a 200 { deduped: true }.
export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const body = await request.json().catch(() => null)
    const isArray = Array.isArray(body)
    const items = isArray ? (body as unknown[]) : [body]
    const results = await captureMessages(items)

    const created = results.filter((r) => !r.deduped)
    if (created.length) {
      const first = created[0].message
      void recordCoworkWrite({
        action: 'create',
        entity: 'whatsapp_message',
        entityId: first.id,
        entityLabel: first.display_name ?? 'WhatsApp',
        engagementId: first.engagement_id,
        summary: `Captured ${created.length} WhatsApp message${created.length === 1 ? '' : 's'}${created.some((r) => r.message.is_draft) ? ' (incl. draft)' : ''} — ${first.display_name ?? 'unknown'}: "${(first.body ?? '').slice(0, 80)}"`,
        payload: body,
      })
    }

    const shaped = results.map((r) => ({ ...r.message, deduped: r.deduped }))
    const status = created.length ? 201 : 200
    return Response.json(isArray ? { messages: shaped, created: created.length, deduped: results.length - created.length } : shaped[0], { status })
  } catch (error) {
    return jsonError(error, 'Failed to capture WhatsApp message')
  }
}
