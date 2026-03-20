import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const type = request.nextUrl.searchParams.get('type')

  let query = supabase.from('income_streams').select('*, crm_accounts(name)').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const streams = (data || []).map((s: Record<string, unknown>) => ({
    ...s,
    account_name: (s.crm_accounts as { name: string } | null)?.name ?? null,
    crm_accounts: undefined,
  }))

  return NextResponse.json({ streams })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.ctx.supabase.from('income_streams').insert({
    workspace_id: workspaceId,
    name: body.name,
    type: body.type || 'other',
    description: body.description || null,
    account_id: body.account_id || null,
    is_active: body.is_active ?? true,
    config: body.config || {},
    currency: body.currency || 'GBP',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stream: data }, { status: 201 })
}
