import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { getCoworkTimeEntry, patchCoworkTimeEntry } from '@/lib/cowork-engagements'
import { recordCoworkWrite } from '@/lib/cowork-audit'

// GET /api/cowork/time/[id] — one entry with engagement/project/task/account expanded.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { id } = await params
    return Response.json(await getCoworkTimeEntry(id))
  } catch (error) {
    return jsonError(error, 'Failed to load time entry')
  }
}

// PATCH /api/cowork/time/[id] — amend an entry (never deletes). Linking a task
// backfills engagement/project from the ticket; a caller engagement_id that
// contradicts the task is a 409. The snapshot rate is history: it is re-taken only
// on an engagement change (incl. null → engagement) or with resnapshot_rate:true,
// and an explicit rate_snapshot in the body always wins.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { entry, warning, rate_change } = await patchCoworkTimeEntry(id, body)
    const label = entry.engagement?.code ?? entry.project?.name ?? entry.account?.name ?? 'general'
    void recordCoworkWrite({
      action: 'update',
      entity: 'time_entry',
      entityId: entry.id,
      entityLabel: `${entry.hours}h on ${label}`,
      engagementId: entry.engagement?.id ?? null,
      summary: `Amended time entry — ${entry.hours}h on ${label} at £${entry.rate_snapshot}/h${rate_change ? ` (rate ${rate_change.from}→${rate_change.to}: ${rate_change.reason})` : ''}`,
      payload: body,
    })
    const response: Record<string, unknown> = { ...entry }
    if (warning) response.warning = warning
    if (rate_change) response.rate_change = rate_change
    return Response.json(response)
  } catch (error) {
    return jsonError(error, 'Failed to amend time entry')
  }
}
