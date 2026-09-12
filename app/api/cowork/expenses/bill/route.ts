import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { billCoworkExpenses } from '@/lib/cowork-expenses'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { formatMoney } from '@/lib/money'

// POST { expense_ids: [], invoice_id } — put expenses onto a draft or sent
// invoice as line items and mark them billed, in one call.
export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const body = (await request.json().catch(() => ({}))) as { expense_ids?: string[]; invoice_id?: string }
    const result = await billCoworkExpenses({ expense_ids: body.expense_ids ?? [], invoice_id: body.invoice_id ?? '' })
    const total = result.expenses.reduce((s, e) => s + e.amount, 0)
    void recordCoworkWrite({
      action: 'update',
      entity: 'expense',
      entityId: result.invoice.id,
      entityLabel: result.invoice.invoice_number,
      engagementId: (result.invoice as { engagement?: { id: string } | null }).engagement?.id ?? null,
      summary: `Billed ${result.expenses.length} expense${result.expenses.length === 1 ? '' : 's'} (${formatMoney(total, result.invoice.currency)}) onto ${result.invoice.invoice_number}`,
      // billed_via marks this row as revertible via releaseCoworkExpenses.
      payload: { billed_via: 'bill', expense_ids: body.expense_ids, invoice_id: body.invoice_id },
    })
    return Response.json(result)
  } catch (error) {
    return jsonError(error, 'Failed to bill expenses')
  }
}
