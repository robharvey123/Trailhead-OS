import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  ACCOUNT_SELECT,
  accountCounts,
  findAccountByExactName,
  formatAccount,
  getWorkstreamBySlug,
  jsonError,
  optionalNumber,
  optionalString,
  parseAccountStatus,
  parseLimit,
  parseTags,
  requiredString,
} from '@/lib/cowork-api'
import { recordCoworkWrite } from '@/lib/cowork-audit'
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
    const name = requiredString(body.name, 'name')

    const existing = await findAccountByExactName(name)
    if (existing) {
      const { contacts, openTasks } = await accountCounts([existing.id])
      return Response.json(
        {
          error: `An account named "${existing.name}" already exists`,
          account: formatAccount(existing as never, {
            contacts: contacts.get(existing.id) ?? 0,
            open_tasks: openTasks.get(existing.id) ?? 0,
          }),
        },
        { status: 409 }
      )
    }

    const workstreamSlug = optionalString(body.workstream)
    const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null

    const { data, error } = await supabaseService
      .from('accounts')
      .insert({
        name,
        website: optionalString(body.website),
        industry: optionalString(body.industry),
        status: parseAccountStatus(body.status),
        channel: optionalString(body.channel),
        source: optionalString(body.source),
        address_line1: optionalString(body.address_line1),
        address_line2: optionalString(body.address_line2),
        city: optionalString(body.city),
        postcode: optionalString(body.postcode),
        country: optionalString(body.country),
        notes: optionalString(body.notes),
        tags: parseTags(body.tags) ?? [],
        default_hourly_rate: optionalNumber(body.default_hourly_rate, 'default_hourly_rate'),
        hq_address: optionalString(body.hq_address),
        workstream_id: workstream?.id ?? null,
      })
      .select(ACCOUNT_SELECT)
      .single()
    if (error) throw error

    const account = formatAccount(data as never, { contacts: 0, open_tasks: 0 })
    void recordCoworkWrite({
      action: 'create',
      entity: 'account',
      entityId: account.id,
      entityLabel: account.name,
      summary: `Created account "${account.name}"${account.status ? ` (${account.status})` : ''}`,
      payload: body,
    })
    return Response.json(account, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create account')
  }
}
