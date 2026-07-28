import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { createAudience, listAudiences } from '@/lib/cowork-outreach'
import { recordCoworkWrite } from '@/lib/cowork-audit'

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    return Response.json(await listAudiences())
  } catch (error) {
    return jsonError(error, 'Failed to load audiences')
  }
}

export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const audience = await createAudience(body)
    void recordCoworkWrite({
      action: 'create',
      entity: 'outreach_audience',
      entityId: audience.id,
      entityLabel: audience.name,
      summary: `Created outreach audience "${audience.name}"`,
      payload: body,
    })
    return Response.json(audience, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create audience')
  }
}
