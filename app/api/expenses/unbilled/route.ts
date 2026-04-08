import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUnbilledExpensesForAccount } from '@/lib/db/expenses'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('account_id')

    if (!accountId) {
      return NextResponse.json(
        { error: 'account_id is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const expenses = await getUnbilledExpensesForAccount(accountId, supabase)

    return NextResponse.json({ expenses })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load unbilled expenses' },
      { status: 500 }
    )
  }
}
