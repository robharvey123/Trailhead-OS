import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getExpenses,
  createExpense,
  type ExpenseFilters,
} from '@/lib/db/expenses'
import type { ExpenseCategory } from '@/lib/types'

const VALID_CATEGORIES: ExpenseCategory[] = [
  'travel',
  'software',
  'equipment',
  'meals',
  'subscriptions',
  'other',
]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters: ExpenseFilters = {}

    const workstreamId = searchParams.get('workstream_id')
    if (workstreamId) filters.workstream_id = workstreamId

    const accountId = searchParams.get('account_id')
    if (accountId) filters.account_id = accountId

    const projectId = searchParams.get('project_id')
    if (projectId) filters.project_id = projectId

    const category = searchParams.get('category')
    if (category && VALID_CATEGORIES.includes(category as ExpenseCategory)) {
      filters.category = category as ExpenseCategory
    }

    const billable = searchParams.get('billable')
    if (billable === 'true') filters.billable = true
    if (billable === 'false') filters.billable = false

    const billed = searchParams.get('billed')
    if (billed === 'true') filters.billed = true
    if (billed === 'false') filters.billed = false

    const dateFrom = searchParams.get('date_from')
    if (dateFrom) filters.date_from = dateFrom

    const dateTo = searchParams.get('date_to')
    if (dateTo) filters.date_to = dateTo

    const supabase = await createClient()
    const expenses = await getExpenses(filters, supabase)

    return NextResponse.json({ expenses })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load expenses' },
      { status: 500 }
    )
  }
}

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

    if (!body.description?.trim()) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      )
    }

    if (body.amount == null || !Number.isFinite(Number(body.amount)) || Number(body.amount) < 0) {
      return NextResponse.json(
        { error: 'A valid amount is required' },
        { status: 400 }
      )
    }

    if (body.category && !VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      )
    }

    const payload = {
      date: body.date || new Date().toISOString().slice(0, 10),
      description: body.description.trim(),
      amount: Number(body.amount),
      currency: body.currency || 'GBP',
      category: body.category || 'other',
      receipt_url: body.receipt_url || null,
      workstream_id: body.workstream_id || null,
      account_id: body.account_id || null,
      project_id: body.project_id || null,
      billable: Boolean(body.billable),
      billed: false,
      invoice_id: null,
      tax_deductible: body.tax_deductible !== false,
      notes: body.notes?.trim() || null,
      user_id: user.id,
    }

    const expense = await createExpense(payload, supabase)

    return NextResponse.json({ expense }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create expense' },
      { status: 500 }
    )
  }
}
