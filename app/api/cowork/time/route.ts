import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  formatTimeEntry,
  jsonError,
  parseBooleanParam,
  parseDateParam,
  parseLimit,
  TIME_ENTRY_SELECT,
} from '@/lib/cowork-api'
import { engagementMonthUsage, getEngagementRow, logTime } from '@/lib/cowork-engagements'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { supabaseService } from '@/lib/supabase/service'

// GET /api/cowork/time — list completed entries with a summary.
export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const sp = request.nextUrl.searchParams
    const engagementRef = sp.get('engagement')
    const projectId = sp.get('project')
    const from = parseDateParam(sp.get('from'), 'from')
    const to = parseDateParam(sp.get('to'), 'to')
    const billable = parseBooleanParam(sp.get('billable'))
    const limit = parseLimit(sp.get('limit'), 100, 500)

    const engagement = engagementRef ? await getEngagementRow(engagementRef) : null

    let query = supabaseService
      .from('time_entries')
      .select(TIME_ENTRY_SELECT)
      .eq('is_running', false)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (engagement) query = query.eq('engagement_id', engagement.id)
    if (projectId) query = query.eq('project_id', projectId)
    if (from) query = query.gte('entry_date', from)
    if (to) query = query.lte('entry_date', to)
    if (billable !== undefined) query = query.eq('billable', billable)

    const { data, error } = await query
    if (error) throw error

    const entries = (data ?? []).map((row) => formatTimeEntry(row as never))
    const totalMinutes = entries.reduce((s, e) => s + e.duration_minutes, 0)
    const billableMinutes = entries.filter((e) => e.billable).reduce((s, e) => s + e.duration_minutes, 0)
    const amount = entries.reduce((s, e) => s + e.amount, 0)

    const summary: Record<string, unknown> = {
      entry_count: entries.length,
      total_hours: Math.round((totalMinutes / 60) * 100) / 100,
      billable_hours: Math.round((billableMinutes / 60) * 100) / 100,
      amount: Math.round(amount * 100) / 100,
    }
    if (engagement) {
      const usage = await engagementMonthUsage(engagement.id)
      summary.this_month = { used: Math.round(usage.used * 100) / 100, included: usage.included, over: Math.round(usage.over * 100) / 100 }
    }

    return Response.json({ entries, summary })
  } catch (error) {
    return jsonError(error, 'Failed to load time entries')
  }
}

// POST /api/cowork/time — log a completed manual entry (source 'cowork'). Snapshots
// the rate; if it pushes the engagement past its monthly cap, the response carries a
// `warning` block.
export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const { entry, warning } = await logTime(body)
    const label = entry.engagement?.code ?? entry.project?.name ?? entry.account?.name ?? 'general'
    void recordCoworkWrite({
      action: 'create',
      entity: 'time_entry',
      entityId: entry.id,
      entityLabel: `${entry.hours}h on ${label}`,
      engagementId: entry.engagement?.id ?? null,
      summary: `Logged ${entry.hours}h on ${label} at £${entry.rate_snapshot}/h${warning ? ` — over cap by ${warning.over_by_hours}h` : ''}`,
      payload: body,
    })
    return Response.json(warning ? { ...entry, warning } : entry, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to log time')
  }
}
