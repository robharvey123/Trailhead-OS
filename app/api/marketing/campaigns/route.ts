import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const status = request.nextUrl.searchParams.get('status')

  let query = supabase.from('marketing_campaigns').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase, userId } = auth.ctx
  const { data, error } = await supabase.from('marketing_campaigns').insert({
    workspace_id: workspaceId,
    name: body.name,
    description: body.description || null,
    type: body.type || 'promotion',
    status: body.status || 'draft',
    channel: body.channel || null,
    budget_allocated: body.budget_allocated || 0,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    target_audience: body.target_audience || null,
    goals: body.goals || null,
    results: body.results || null,
    tags: body.tags || [],
    owner_user_id: userId,
    created_by: userId,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaign: data }, { status: 201 })
}
