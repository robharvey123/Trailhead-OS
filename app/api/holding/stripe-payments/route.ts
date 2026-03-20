import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const status = request.nextUrl.searchParams.get('status')
  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')

  let query = supabase.from('stripe_payments').select('*').eq('workspace_id', workspaceId).order('payment_date', { ascending: false })
  if (status) query = query.eq('status', status)
  if (from) query = query.gte('payment_date', from)
  if (to) query = query.lte('payment_date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payments: data || [] })
}
