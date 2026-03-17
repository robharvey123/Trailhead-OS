import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const campaignId = request.nextUrl.searchParams.get('campaign_id')
  const status = request.nextUrl.searchParams.get('status')

  let query = supabase.from('marketing_content').select('*').eq('workspace_id', workspaceId).order('scheduled_date', { ascending: true })
  if (campaignId) query = query.eq('campaign_id', campaignId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ content: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase, userId } = auth.ctx
  const { data, error } = await supabase.from('marketing_content').insert({
    workspace_id: workspaceId,
    campaign_id: body.campaign_id || null,
    title: body.title,
    content_type: body.content_type || 'post',
    channel: body.channel || null,
    body: body.body || null,
    scheduled_date: body.scheduled_date || null,
    scheduled_time: body.scheduled_time || null,
    status: body.status || 'idea',
    tags: body.tags || [],
    assigned_to: body.assigned_to || null,
    created_by: userId,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ content: data }, { status: 201 })
}
