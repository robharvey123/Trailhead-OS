import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const staffId = request.nextUrl.searchParams.get('staff_id')
  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')

  let query = auth.ctx.supabase.from('staff_time_entries').select('*, staff_profiles(display_name), workspace_tasks(title)').eq('workspace_id', workspaceId).order('date', { ascending: false })
  if (staffId) query = query.eq('staff_profile_id', staffId)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const entries = (data || []).map((d: Record<string, unknown>) => ({
    ...d,
    staff_name: (d.staff_profiles as { display_name: string } | null)?.display_name || null,
    task_title: (d.workspace_tasks as { title: string } | null)?.title || null,
  }))
  return NextResponse.json({ time_entries: entries })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.ctx.supabase.from('staff_time_entries').insert({
    workspace_id: workspaceId,
    staff_profile_id: body.staff_profile_id,
    task_id: body.task_id || null,
    date: body.date || new Date().toISOString().slice(0, 10),
    hours: body.hours,
    description: body.description || null,
    billable: body.billable ?? true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ time_entry: data }, { status: 201 })
}
