import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  ACCOUNT_SELECT,
  accountCounts,
  formatAccount,
  getWorkstreamBySlug,
  jsonError,
  parseAccountStatus,
  parseLimit,
} from '@/lib/cowork-api'
import { createCoworkAccount } from '@/lib/cowork-accounts'
import { supabaseService } from '@/lib/supabase/service'

// GET /api/cowork/accounts — list accounts with contact + open-task counts.
export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const sp = request.nextUrl.searchParams
    const search = sp.get('search')
    const statusParam = sp.get('status')
    const workstreamSlug = sp.get('workstream')
    const tag = sp.get('tag')
    const limit = parseLimit(sp.get('limit'), 50, 200)
    const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null

    let query = supabaseService
      .from('accounts')
      .select(ACCOUNT_SELECT)
      .eq('record_type', 'sales')
      .order('name', { ascending: true })
      .limit(limit)

    if (search) query = query.ilike('name', `%${search}%`)
    if (statusParam) query = query.eq('status', parseAccountStatus(statusParam))
    if (workstream) query = query.eq('workstream_id', workstream.id)
    if (tag) query = query.contains('tags', [tag])

    const { data, error } = await query
    if (error) throw error

    const rows = (data ?? []) as never[]
    const ids = rows.map((r) => (r as { id: string }).id)
    const { contacts, openTasks } = await accountCounts(ids)
    return Response.json(
      rows.map((r) => {
        const id = (r as { id: string }).id
        return formatAccount(r as never, { contacts: contacts.get(id) ?? 0, open_tasks: openTasks.get(id) ?? 0 })
      })
    )
  } catch (error) {
    return jsonError(error, 'Failed to load accounts')
  }
}

// POST /api/cowork/accounts — create. A case-insensitive duplicate name returns
// 409 WITH the existing row and creates nothing (the whole point of this endpoint:
// stop a second "Wide Advocacy SRL" landing next to "Wide Advocacy").
export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { existing, account } = await createCoworkAccount(body)
    if (existing) {
      return Response.json(
        { error: `An account named "${account.name}" already exists`, account },
        { status: 409 }
      )
    }
    return Response.json(account, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create account')
  }
}
