import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError, parseDateParam, parseLimit } from '@/lib/cowork-api'
import { listCoworkActivity } from '@/lib/cowork-audit'

// GET /api/cowork/activity — recent activity, filterable by engagement, entity, date.
export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const sp = request.nextUrl.searchParams
    return Response.json(
      await listCoworkActivity({
        engagementId: sp.get('engagement') ?? undefined,
        entity: sp.get('entity') ?? undefined,
        from: parseDateParam(sp.get('from'), 'from') ?? undefined,
        to: parseDateParam(sp.get('to'), 'to') ?? undefined,
        limit: parseLimit(sp.get('limit'), 50, 200),
      })
    )
  } catch (error) {
    return jsonError(error, 'Failed to load activity')
  }
}
