import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const stage = request.nextUrl.searchParams.get('stage')
  const accountId = request.nextUrl.searchParams.get('account_id')

  let query = supabase
    .from('crm_deals')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (stage) query = query.eq('stage', stage)
  if (accountId) query = query.eq('account_id', accountId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deals: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase, userId } = auth.ctx

  const { data, error } = await supabase
    .from('crm_deals')
    .insert({
      workspace_id: workspaceId,
      account_id: body.account_id || null,
      contact_id: body.contact_id || null,
      title: body.title,
      value: body.value || null,
      currency: body.currency || 'USD',
      stage: body.stage || 'lead',
      probability: body.probability || 0,
      expected_close_date: body.expected_close_date || null,
      notes: body.notes || null,
      tags: body.tags || [],
      owner_user_id: userId,
      created_by: userId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deal: data }, { status: 201 })
}
