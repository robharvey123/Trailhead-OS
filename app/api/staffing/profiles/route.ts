import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const department = request.nextUrl.searchParams.get('department')
  let query = auth.ctx.supabase.from('staff_profiles').select('*').eq('workspace_id', workspaceId).order('display_name')
  if (department) query = query.eq('department', department)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ staff: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.ctx.supabase.from('staff_profiles').insert({
    workspace_id: workspaceId,
    user_id: body.user_id || auth.ctx.userId,
    display_name: body.display_name,
    email: body.email || null,
    phone: body.phone || null,
    department: body.department || null,
    role_title: body.role_title || null,
    employment_type: body.employment_type || 'full_time',
    hourly_rate: body.hourly_rate ?? null,
    capacity_hours_per_week: body.capacity_hours_per_week ?? 40,
    start_date: body.start_date || null,
    tags: body.tags || [],
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data }, { status: 201 })
}
