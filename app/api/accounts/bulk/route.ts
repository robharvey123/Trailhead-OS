import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { updateAccount, deleteAccount } from '@/lib/db/accounts'
import { tagAccount } from '@/lib/db/tags'
import type { AccountStatus } from '@/lib/types'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Bulk account operations.
 * POST { ids: string[], action: 'tag' | 'status' | 'terms' | 'delete', tag_id?, status?, payment_terms_days? }
 */
export async function POST(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const body = await request.json()
    const ids: string[] = Array.isArray(body.ids) ? body.ids : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids is required' }, { status: 400 })
    }

    switch (body.action) {
      case 'tag': {
        if (!body.tag_id) {
          return NextResponse.json({ error: 'tag_id is required' }, { status: 400 })
        }
        await Promise.all(ids.map((id) => tagAccount(id, body.tag_id, supabase)))
        break
      }
      case 'status': {
        if (!body.status) {
          return NextResponse.json({ error: 'status is required' }, { status: 400 })
        }
        await Promise.all(
          ids.map((id) => updateAccount(id, { status: body.status as AccountStatus }, supabase))
        )
        break
      }
      case 'terms': {
        // null clears back to "inherit the company default" — the desired state
        // for most accounts, so never backfill a number everywhere.
        const raw = body.payment_terms_days
        const days = raw === null || raw === '' || raw === undefined ? null : Number(raw)
        if (days !== null && (!Number.isInteger(days) || days < 0 || days > 365)) {
          return NextResponse.json({ error: 'payment_terms_days must be a whole number of days between 0 and 365, or null' }, { status: 400 })
        }
        await Promise.all(ids.map((id) => updateAccount(id, { payment_terms_days: days }, supabase)))
        break
      }
      case 'delete': {
        await Promise.all(ids.map((id) => deleteAccount(id, supabase)))
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    return NextResponse.json({ updated: ids.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bulk operation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
