import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError, parseDateParam, parseLimit } from '@/lib/cowork-api'
import { createCoworkTouchpoint, listCoworkTouchpoints } from '@/lib/cowork-touchpoints'
import { recordCoworkWrite } from '@/lib/cowork-audit'

// GET /api/cowork/touchpoints — filter by engagement (uuid or code), account,
// contact, type, from/to, limit.
export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const sp = request.nextUrl.searchParams
    return Response.json(
      await listCoworkTouchpoints({
        engagementRef: sp.get('engagement') ?? undefined,
        accountId: sp.get('account_id') ?? undefined,
        contactId: sp.get('contact_id') ?? undefined,
        type: sp.get('type') ?? undefined,
        from: parseDateParam(sp.get('from'), 'from') ?? undefined,
        to: parseDateParam(sp.get('to'), 'to') ?? undefined,
        limit: parseLimit(sp.get('limit'), 50, 200),
      })
    )
  } catch (error) {
    return jsonError(error, 'Failed to load touchpoints')
  }
}

// POST — log a touchpoint. Requires subject + one of engagement/account/contact.
export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const touchpoint = await createCoworkTouchpoint(body)
    void recordCoworkWrite({
      action: 'create',
      entity: 'touchpoint',
      entityId: touchpoint.id,
      entityLabel: touchpoint.subject,
      engagementId: touchpoint.engagement?.id ?? null,
      summary: `Logged ${touchpoint.type} "${touchpoint.subject}"${touchpoint.engagement ? ` on ${touchpoint.engagement.name}` : ''}`,
      payload: body,
    })
    return Response.json(touchpoint, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to log touchpoint')
  }
}
