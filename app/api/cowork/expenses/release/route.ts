import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { releaseCoworkExpenses } from '@/lib/cowork-expenses'
import { recordCoworkWrite } from '@/lib/cowork-audit'

// POST { expense_ids: [] } — take billed expenses back off their invoice
// (line items removed, billed reset). 409 when the invoice is already paid.
export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) return Response.json({ error: 'Unauthorised' }, { status: 401 })
  try {
    const body = (await request.json().catch(() => ({}))) as { expense_ids?: string[] }
    const invoiceNumbers = new Set<string>()
    const result = await releaseCoworkExpenses({ expense_ids: body.expense_ids ?? [] })
    for (const e of result.expenses) if (e.invoice?.invoice_number) invoiceNumbers.add(e.invoice.invoice_number)
    void recordCoworkWrite({
      action: 'update',
      entity: 'expense',
      entityLabel: `${result.expenses.length} released`,
      summary: `Released ${result.expenses.length} expense${result.expenses.length === 1 ? '' : 's'} back to unbilled`,
      payload: body,
    })
    return Response.json(result)
  } catch (error) {
    return jsonError(error, 'Failed to release expenses')
  }
}
