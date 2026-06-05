import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { getCoworkBriefing } from '@/lib/cowork-briefing'

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    return Response.json(await getCoworkBriefing())
  } catch (error) {
    return jsonError(error, 'Failed to load briefing')
  }
}
