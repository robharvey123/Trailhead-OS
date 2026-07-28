import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError, optionalString } from '@/lib/cowork-api'
import { getCampaignDetail, requireCampaignId, setCampaignAction } from '@/lib/cowork-outreach'
import { recordCoworkWrite } from '@/lib/cowork-audit'

// GET — campaign stats + per-recipient status counts + recent replies.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id } = await params
    return Response.json(await getCampaignDetail(requireCampaignId(id)))
  } catch (error) {
    return jsonError(error, 'Failed to load campaign')
  }
}

// POST { action: "start" | "pause" | "resume" | "cancel" } — the only way a
// campaign leaves draft. `start`/`resume` validate the templates first.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const action = optionalString(body.action) ?? ''
    const campaign = await setCampaignAction(requireCampaignId(id), action)
    void recordCoworkWrite({
      action: 'update',
      entity: 'outreach_campaign',
      entityId: campaign.id,
      entityLabel: campaign.name,
      summary: `${action.charAt(0).toUpperCase()}${action.slice(1)}d outreach campaign "${campaign.name}" (now ${campaign.status})`,
      payload: { action },
    })
    return Response.json(campaign)
  } catch (error) {
    return jsonError(error, 'Failed to update campaign')
  }
}
