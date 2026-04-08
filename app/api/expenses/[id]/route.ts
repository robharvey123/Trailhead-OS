import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getExpenseById,
  updateExpense,
  deleteExpense,
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const expense = await getExpenseById(id, supabase)

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    return NextResponse.json({ expense })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load expense' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const patch: Record<string, unknown> = {}

    if ('date' in body) patch.date = body.date
    if ('description' in body) patch.description = body.description?.trim()
    if ('amount' in body) {
      const amount = Number(body.amount)
      if (!Number.isFinite(amount) || amount < 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
      }
      patch.amount = amount
    }
    if ('currency' in body) patch.currency = body.currency
    if ('category' in body) {
      if (!VALID_CATEGORIES.includes(body.category)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      }
      patch.category = body.category
    }
    if ('receipt_url' in body) patch.receipt_url = body.receipt_url || null
    if ('workstream_id' in body) patch.workstream_id = body.workstream_id || null
    if ('account_id' in body) patch.account_id = body.account_id || null
    if ('project_id' in body) patch.project_id = body.project_id || null
    if ('billable' in body) patch.billable = Boolean(body.billable)
    if ('billed' in body) patch.billed = Boolean(body.billed)
    if ('invoice_id' in body) patch.invoice_id = body.invoice_id || null
    if ('tax_deductible' in body) patch.tax_deductible = Boolean(body.tax_deductible)
    if ('notes' in body) patch.notes = body.notes?.trim() || null

    const expense = await updateExpense(id, patch, supabase)

    return NextResponse.json({ expense })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update expense' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    await deleteExpense(id, supabase)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete expense' },
      { status: 500 }
    )
  }
}
