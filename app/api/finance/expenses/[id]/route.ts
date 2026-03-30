import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await Promise.resolve(params)
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase, userId } = auth.ctx

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const allowedFields = ['title', 'category', 'amount', 'currency', 'expense_date', 'receipt_url', 'status', 'notes', 'rejection_reason']
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  if (body.status === 'approved') {
    updates.approver_user_id = userId
    updates.approved_at = new Date().toISOString()
  }
  if (body.status === 'rejected') {
    updates.approver_user_id = userId
  }

  const { data: expense, error } = await supabase
    .from('finance_expense_claims')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await Promise.resolve(params)
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { error } = await auth.ctx.supabase
    .from('finance_expense_claims')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
