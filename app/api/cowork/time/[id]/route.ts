import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { deleteCoworkTimeEntry, getCoworkTimeEntry, patchCoworkTimeEntry } from '@/lib/cowork-engagements'
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

// PATCH /api/cowork/time/[id] — amend an entry. Linking a task backfills
// engagement/project from the ticket; a caller engagement_id that contradicts the
// task is a 409, as is any link change on a billed entry. The snapshot rate is history: it is re-taken only
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

// DELETE /api/cowork/time/[id] — permanent. 409 once the entry is billed (release
// it from its invoice first). The deleted row is kept on the activity log.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { id } = await params
    const entry = await deleteCoworkTimeEntry(id)
    const label = entry.engagement?.code ?? entry.project?.name ?? entry.account?.name ?? 'general'
    void recordCoworkWrite({
      action: 'delete',
      entity: 'time_entry',
      entityId: entry.id,
      entityLabel: `${entry.hours}h on ${label}`,
      engagementId: entry.engagement?.id ?? null,
      summary: `Deleted time entry — ${entry.hours}h on ${label} from ${entry.entry_date}`,
      payload: entry,
    })
    return Response.json({ deleted: true, entry })
  } catch (error) {
    return jsonError(error, 'Failed to delete time entry')
  }
}
