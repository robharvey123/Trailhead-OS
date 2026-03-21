import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.ctx.supabase
    .from('finance_expense_claims')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('expense_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expenses: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase, userId } = auth.ctx
  const amount = parseFloat(body.amount)
  if (!amount || amount <= 0) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
  if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const { data: expense, error } = await supabase
    .from('finance_expense_claims')
    .insert({
      workspace_id: workspaceId,
      claimant_user_id: userId,
      title: body.title.trim(),
      category: body.category || 'general',
      amount,
      currency: body.currency || 'GBP',
      expense_date: body.expense_date || new Date().toISOString().slice(0, 10),
      receipt_url: body.receipt_url || null,
      status: body.status || 'draft',
      notes: body.notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense }, { status: 201 })
}
