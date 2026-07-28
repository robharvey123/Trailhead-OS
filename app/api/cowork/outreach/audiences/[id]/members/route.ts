import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { addAudienceMembers } from '@/lib/cowork-outreach'
import { recordCoworkWrite } from '@/lib/cowork-audit'

// POST — snapshot contacts into the audience by contact_ids or a filter object.
// Suppressed / do_not_email / no-email contacts are skipped and counted, never
// silently dropped (the compliance boundary).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const result = await addAudienceMembers(id, { contact_ids: body.contact_ids, filter: body.filter })
    void recordCoworkWrite({
      action: 'update',
      entity: 'outreach_audience',
      entityId: id,
      summary: `Added ${result.added} contacts to an outreach audience (${result.skipped} skipped: ${result.skipped_breakdown.suppressed} suppressed, ${result.skipped_breakdown.do_not_email} do-not-email, ${result.skipped_breakdown.no_email} no email)`,
      payload: body,
    })
    return Response.json(result)
  } catch (error) {
    return jsonError(error, 'Failed to add audience members')
  }
}
