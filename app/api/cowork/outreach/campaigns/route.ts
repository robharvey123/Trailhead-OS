import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { createCampaign, listCampaigns } from '@/lib/cowork-outreach'
import { recordCoworkWrite } from '@/lib/cowork-audit'

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    return Response.json(await listCampaigns())
  } catch (error) {
    return jsonError(error, 'Failed to load campaigns')
  }
}

// POST — create a campaign. It ALWAYS lands in `draft`; Rob starts it with a
// separate explicit call. Claude never fires cold email off its own bat.
export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const campaign = await createCampaign(body)
    void recordCoworkWrite({
      action: 'create',
      entity: 'outreach_campaign',
      entityId: campaign.id,
      entityLabel: campaign.name,
      summary: `Created outreach campaign "${campaign.name}" (draft, ${campaign.steps.length} step${campaign.steps.length === 1 ? '' : 's'}) — not started`,
      payload: body,
    })
    return Response.json(campaign, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create campaign')
  }
}
