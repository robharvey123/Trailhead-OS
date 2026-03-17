import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const status = request.nextUrl.searchParams.get('status')
  let query = auth.ctx.supabase.from('product_launches').select('*, products(name)').eq('workspace_id', workspaceId).order('launch_date', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const launches = (data || []).map((d: Record<string, unknown>) => ({ ...d, product_name: (d.products as { name: string } | null)?.name || null }))
  return NextResponse.json({ launches })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.ctx.supabase.from('product_launches').insert({
    workspace_id: workspaceId,
    product_id: body.product_id || null,
    title: body.title,
    description: body.description || null,
    launch_date: body.launch_date || null,
    status: body.status || 'planning',
    checklist: body.checklist || [],
    assigned_to: body.assigned_to || null,
    created_by: auth.ctx.userId,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ launch: data }, { status: 201 })
}
