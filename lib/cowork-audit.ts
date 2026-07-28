import { supabaseService } from '@/lib/supabase/service'

/**
 * The Cowork activity log. Every mutating /api/cowork/* route (and MCP tool) calls
 * recordCoworkWrite after a successful write so Rob reviews a change log instead of
 * doing data entry.
 *
 * FIRE AND FORGET: this never throws and is never awaited in the response path — a
 * logging failure must never fail the business operation (same contract as
 * sendCoworkTaskNotification in lib/cowork-tasks.ts). Call it as
 * `void recordCoworkWrite({ ... })`.
 *
 * `summary` is the field that matters: write it as a sentence Rob can scan
 * ("Raised TH-0011, £2,500, Booker Tier 1 listing fee, Qola engagement"), not as a
 * machine log line ("invoice.create id=abc123").
 */
export type CoworkAction = 'create' | 'update' | 'delete'

export interface CoworkWrite {
  action: CoworkAction
  entity: string
  entityId?: string | null
  entityLabel?: string | null
  engagementId?: string | null
  summary: string
  payload?: unknown
  before?: unknown
}

export async function recordCoworkWrite(w: CoworkWrite): Promise<void> {
  await supabaseService
    .from('cowork_activity')
    .insert({
      action: w.action,
      entity: w.entity,
      entity_id: w.entityId ?? null,
      entity_label: w.entityLabel ?? null,
      engagement_id: w.engagementId ?? null,
      summary: w.summary,
      payload: (w.payload ?? null) as never,
      before: (w.before ?? null) as never,
    })
    .then(() => {}, () => {}) // swallow — logging must never break the operation
}

export interface ActivityFilters {
  engagementId?: string
  entity?: string
  from?: string
  to?: string
  limit?: number
}

/** Recent activity, newest first. Used by GET /api/cowork/activity and MCP. */
export async function listCoworkActivity(filters: ActivityFilters = {}) {
  let query = supabaseService
    .from('cowork_activity')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(filters.limit ?? 50, 200))
  if (filters.engagementId) query = query.eq('engagement_id', filters.engagementId)
  if (filters.entity) query = query.eq('entity', filters.entity)
  if (filters.from) query = query.gte('created_at', filters.from)
  if (filters.to) query = query.lte('created_at', filters.to)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export type RevertResult = { ok: true; entity: string; summary: string } | { ok: false; error: string; status: number }

/**
 * Revert a Cowork write for the reversible cases only:
 *   - invoice status change  → restore the prior status (from `before`)
 *   - time_entry create      → delete the entry
 *   - tier1_milestone gate   → restore the prior gate dates (from `before`)
 * Anything else is a 400 — there is no generic revert. Stamps reverted_at so a
 * revert can't be applied twice.
 */
export async function revertCoworkActivity(activityId: string): Promise<RevertResult> {
  const { data: row, error } = await supabaseService.from('cowork_activity').select('*').eq('id', activityId).maybeSingle()
  if (error) return { ok: false, error: error.message, status: 500 }
  if (!row) return { ok: false, error: 'Activity not found', status: 404 }
  const a = row as {
    id: string; action: string; entity: string; entity_id: string | null
    entity_label: string | null; before: Record<string, unknown> | null; reverted_at: string | null
  }
  if (a.reverted_at) return { ok: false, error: 'Already reverted', status: 400 }
  if (!a.entity_id) return { ok: false, error: 'Activity has no entity to revert', status: 400 }

  if (a.entity === 'invoice' && a.action === 'update' && a.before && 'status' in a.before) {
    const prior = a.before.status as string
    const patch: Record<string, unknown> = { status: prior }
    if (prior !== 'paid') patch.paid_at = null
    const { error: e } = await supabaseService.from('invoices').update(patch).eq('id', a.entity_id)
    if (e) return { ok: false, error: e.message, status: 500 }
  } else if (a.entity === 'time_entry' && a.action === 'create') {
    const { error: e } = await supabaseService.from('time_entries').delete().eq('id', a.entity_id)
    if (e) return { ok: false, error: e.message, status: 500 }
  } else if (a.entity === 'tier1_milestone' && a.before) {
    const gateCols = ['range_review_decided_at', 'go_live_confirmed_at', 'first_po_received_at']
    const patch: Record<string, unknown> = {}
    for (const c of gateCols) if (c in a.before) patch[c] = a.before[c] ?? null
    if (Object.keys(patch).length === 0) return { ok: false, error: 'No gate state to restore', status: 400 }
    const { error: e } = await supabaseService.from('tier1_milestones').update(patch).eq('id', a.entity_id)
    if (e) return { ok: false, error: e.message, status: 500 }
  } else {
    return { ok: false, error: `Revert not supported for ${a.entity} ${a.action}`, status: 400 }
  }

  await supabaseService.from('cowork_activity').update({ reverted_at: new Date().toISOString() }).eq('id', a.id)
  return { ok: true, entity: a.entity, summary: `Reverted: ${a.entity_label ?? a.entity}` }
}
