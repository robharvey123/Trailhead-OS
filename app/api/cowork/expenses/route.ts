import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError, parseBooleanParam, parseDateParam, parseLimit } from '@/lib/cowork-api'
import { createCoworkExpense, listCoworkExpenses } from '@/lib/cowork-expenses'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { formatMoney } from '@/lib/money'

// GET /api/cowork/expenses — engagement_id (code or uuid), project_id,
// account_id, category, billable, billed, from, to, limit (default 100, max 500).
export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const sp = request.nextUrl.searchParams
    return Response.json(
      await listCoworkExpenses({
        engagementRef: sp.get('engagement_id') ?? sp.get('engagement'),
        projectId: sp.get('project_id') ?? sp.get('project'),
        accountId: sp.get('account_id'),
        category: sp.get('category'),
        billable: parseBooleanParam(sp.get('billable')),
        billed: parseBooleanParam(sp.get('billed')),
        from: parseDateParam(sp.get('from'), 'from'),
        to: parseDateParam(sp.get('to'), 'to'),
        limit: parseLimit(sp.get('limit'), 100, 500),
      })
    )
  } catch (error) {
    return jsonError(error, 'Failed to load expenses')
  }
}

// POST — log an expense. Links derive like time entries: project fills
// engagement + account, engagement fills its end-client account.
export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({}))
    const expense = await createCoworkExpense(body)
    const label = expense.engagement?.code ?? expense.project?.name ?? expense.account?.name ?? 'general'
    void recordCoworkWrite({
      action: 'create',
      entity: 'expense',
      entityId: expense.id,
      entityLabel: `${formatMoney(expense.amount, expense.currency)} ${expense.category}`,
      engagementId: expense.engagement?.id ?? null,
      summary: `Logged ${formatMoney(expense.amount, expense.currency)} ${expense.category} on ${label} (${expense.billable ? 'billable' : 'non-billable'})`,
      payload: body,
    })
    return Response.json(expense, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create expense')
  }
}
