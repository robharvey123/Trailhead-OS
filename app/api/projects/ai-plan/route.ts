import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { requiredString, optionalDate, optionalString, jsonError, todayDate } from '@/lib/cowork-api'
import { planProjectFromBrief } from '@/lib/project-planner'

export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const result = await planProjectFromBrief({
      projectId: requiredString(body.project_id, 'project_id'),
      projectName: optionalString(body.project_name) ?? 'Project',
      workstreamId: requiredString(body.workstream_id, 'workstream_id'),
      pricingTierId: optionalString(body.pricing_tier_id),
      startDate: optionalDate(body.start_date, 'start_date') ?? todayDate(),
      brief: requiredString(body.brief, 'brief'),
    })

    return Response.json(result)
  } catch (error) {
    return jsonError(error, 'Failed to AI plan project')
  }
}
