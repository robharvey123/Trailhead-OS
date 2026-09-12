import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { deleteCoworkExpense, getCoworkExpense, patchCoworkExpense } from '@/lib/cowork-expenses'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { formatMoney } from '@/lib/money'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id } = await params
    return Response.json(await getCoworkExpense(id))
  } catch (error) {
    return jsonError(error, 'Failed to load expense')
  }
}

// PATCH — amend. A billed expense rejects amount/currency/date/billable changes
// (release it from its invoice first); billed/invoice_id go through the bill
// and release routes, never here.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const before = await getCoworkExpense(id)
    const expense = await patchCoworkExpense(id, body)
    const label = expense.engagement?.code ?? expense.project?.name ?? expense.account?.name ?? 'general'
    void recordCoworkWrite({
      action: 'update',
      entity: 'expense',
      entityId: expense.id,
      entityLabel: `${formatMoney(expense.amount, expense.currency)} ${expense.category}`,
      engagementId: expense.engagement?.id ?? null,
      summary: `Amended expense: ${formatMoney(expense.amount, expense.currency)} ${expense.category} "${expense.description}" on ${label}`,
      payload: body,
      before,
    })
    return Response.json(expense)
  } catch (error) {
    return jsonError(error, 'Failed to update expense')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const { id } = await params
    const deleted = await deleteCoworkExpense(id)
    const label = deleted.engagement?.code ?? deleted.project?.name ?? deleted.account?.name ?? 'general'
    void recordCoworkWrite({
      action: 'delete',
      entity: 'expense',
      entityId: deleted.id,
      entityLabel: `${formatMoney(deleted.amount, deleted.currency)} ${deleted.category}`,
      engagementId: deleted.engagement?.id ?? null,
      summary: `Deleted expense ${formatMoney(deleted.amount, deleted.currency)} ${deleted.category} on ${label}`,
      before: deleted,
    })
    return Response.json({ deleted: true, expense: deleted })
  } catch (error) {
    return jsonError(error, 'Failed to delete expense')
  }
}
