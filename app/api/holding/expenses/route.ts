import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const streamId = request.nextUrl.searchParams.get('stream_id')
  const category = request.nextUrl.searchParams.get('category')

  let query = supabase.from('holding_expenses').select('*').eq('workspace_id', workspaceId).order('expense_date', { ascending: false })
  if (streamId) query = query.eq('stream_id', streamId)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expenses: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.ctx.supabase.from('holding_expenses').insert({
    workspace_id: workspaceId,
    stream_id: body.stream_id || null,
    category: body.category || 'other',
    description: body.description,
    amount: body.amount,
    currency: body.currency || 'GBP',
    expense_date: body.expense_date || new Date().toISOString().slice(0, 10),
    vendor: body.vendor || null,
    is_recurring: body.is_recurring ?? false,
    recurrence_period: body.recurrence_period || null,
    receipt_url: body.receipt_url || null,
    notes: body.notes || null,
    created_by: auth.ctx.userId,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense: data }, { status: 201 })
}
