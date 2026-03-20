import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')
  const direction = request.nextUrl.searchParams.get('direction') // 'in' | 'out'
  const reconciled = request.nextUrl.searchParams.get('reconciled') // 'true' | 'false'
  const search = request.nextUrl.searchParams.get('search')

  let query = supabase.from('bank_transactions').select('*').eq('workspace_id', workspaceId).order('date', { ascending: false })

  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)
  if (direction === 'in') query = query.gt('amount', 0)
  if (direction === 'out') query = query.lt('amount', 0)
  if (reconciled === 'true') query = query.eq('reconciled', true)
  if (reconciled === 'false') query = query.eq('reconciled', false)
  if (search) query = query.or(`counterparty.ilike.%${search}%,reference.ilike.%${search}%,description.ilike.%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transactions: data || [] })
}
