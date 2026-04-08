import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { markExpensesAsBilled } from '@/lib/db/expenses'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!Array.isArray(body.expense_ids) || body.expense_ids.length === 0) {
      return NextResponse.json(
        { error: 'expense_ids array is required' },
        { status: 400 }
      )
    }

    if (!body.invoice_id) {
      return NextResponse.json(
        { error: 'invoice_id is required' },
        { status: 400 }
      )
    }

    await markExpensesAsBilled(body.expense_ids, body.invoice_id, supabase)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to mark expenses as billed' },
      { status: 500 }
    )
  }
}
