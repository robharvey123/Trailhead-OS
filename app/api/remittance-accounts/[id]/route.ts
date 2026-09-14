import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { deleteRemittanceAccount, updateRemittanceAccount } from '@/lib/db/remittance-accounts'
import { validateRemittanceAccount } from '@/lib/remittance'
import type { RemittanceRail } from '@/lib/types'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    // A patch that touches identity/number fields re-validates the merged view;
    // an active/sort_order-only toggle skips straight through.
    const validatedKeys = ['rail', 'label', 'beneficiary_name', 'iban', 'bic', 'intermediary_bic', 'sort_code', 'account_number', 'routing_number']
    if (validatedKeys.some((k) => k in body)) {
      const { data: current } = await supabase.from('remittance_accounts').select('*').eq('id', id).maybeSingle()
      if (!current) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      const merged = { ...current, ...body, rail: (body.rail ?? current.rail) as RemittanceRail }
      const errors = validateRemittanceAccount(merged as never)
      if (Object.keys(errors).length) {
        return NextResponse.json({ error: Object.values(errors)[0], errors }, { status: 400 })
      }
    }

    const account = await updateRemittanceAccount(id, body as never, supabase)
    return NextResponse.json({ account })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update account' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response
    const { id } = await params
    await deleteRemittanceAccount(id, supabase)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete account' }, { status: 500 })
  }
}
