import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { findAccountByExactName, isUuid, jsonError, parseLimit } from '@/lib/cowork-api'
import { createEngagement, listEngagements } from '@/lib/cowork-engagements'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import type { EngagementStatus } from '@/lib/types'

const STATUSES = new Set<EngagementStatus>(['Draft', 'Active', 'Paused', 'Completed', 'Terminated'])

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const sp = request.nextUrl.searchParams
    const statusParam = sp.get('status')
    const accountParam = sp.get('account')
    const limit = parseLimit(sp.get('limit'), 50, 200)

    let status: EngagementStatus | undefined
    if (statusParam) {
      if (!STATUSES.has(statusParam as EngagementStatus)) {
        return Response.json({ error: `status must be one of ${[...STATUSES].join(', ')}` }, { status: 400 })
      }
      status = statusParam as EngagementStatus
    }

    let accountId: string | undefined
    if (accountParam) {
      accountId = isUuid(accountParam) ? accountParam : (await findAccountByExactName(accountParam))?.id
      if (!accountId) return Response.json({ error: `Account not found: ${accountParam}` }, { status: 400 })
    }

    return Response.json(await listEngagements({ status, accountId, limit }))
  } catch (error) {
    return jsonError(error, 'Failed to load engagements')
  }
}

export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const engagement = await createEngagement(body)
    void recordCoworkWrite({
      action: 'create',
      entity: 'engagement',
      entityId: engagement.id,
      entityLabel: engagement.code ?? engagement.name,
      engagementId: engagement.id,
      summary: `Created engagement "${engagement.name}"${engagement.code ? ` (${engagement.code})` : ''}, end client ${engagement.end_client?.name ?? '—'}, status ${engagement.status}`,
      payload: body,
    })
    return Response.json(engagement, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create engagement')
  }
}
