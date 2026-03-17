import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const staffId = request.nextUrl.searchParams.get('staff_id')
  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')

  let query = auth.ctx.supabase.from('staff_schedules').select('*, staff_profiles(display_name)').eq('workspace_id', workspaceId).order('date').order('start_time')
  if (staffId) query = query.eq('staff_profile_id', staffId)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const schedules = (data || []).map((d: Record<string, unknown>) => ({ ...d, staff_name: (d.staff_profiles as { display_name: string } | null)?.display_name || null }))
  return NextResponse.json({ schedules })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.ctx.supabase.from('staff_schedules').insert({
    workspace_id: workspaceId,
    staff_profile_id: body.staff_profile_id,
    date: body.date,
    start_time: body.start_time,
    end_time: body.end_time,
    type: body.type || 'work',
    title: body.title || null,
    notes: body.notes || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ schedule: data }, { status: 201 })
}
