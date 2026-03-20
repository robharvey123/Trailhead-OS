import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const streamId = request.nextUrl.searchParams.get('stream_id')
  const brand = request.nextUrl.searchParams.get('brand')

  let query = supabase.from('commission_rates').select('*').eq('workspace_id', workspaceId).order('effective_from', { ascending: false })
  if (streamId) query = query.eq('stream_id', streamId)
  if (brand) query = query.eq('brand', brand)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rates: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.ctx.supabase.from('commission_rates').insert({
    workspace_id: workspaceId,
    stream_id: body.stream_id,
    source_workspace_id: body.source_workspace_id,
    brand: body.brand,
    commission_type: body.commission_type || 'percentage',
    rate: body.rate,
    effective_from: body.effective_from,
    effective_to: body.effective_to || null,
    notes: body.notes || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rate: data }, { status: 201 })
}
