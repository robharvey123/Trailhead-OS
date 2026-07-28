import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  ACCOUNT_SELECT,
  accountCounts,
  formatAccount,
  getAccountById,
  getWorkstreamBySlug,
  jsonError,
  optionalString,
  parseAccountStatus,
  parseTags,
} from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { id } = await params
    const account = await getAccountById(id)
    const { contacts, openTasks } = await accountCounts([id])
    return Response.json(
      formatAccount(account as never, { contacts: contacts.get(id) ?? 0, open_tasks: openTasks.get(id) ?? 0 })
    )
  } catch (error) {
    return jsonError(error, 'Failed to load account')
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { id } = await params
    await getAccountById(id) // 404 if missing
    const body = await request.json().catch(() => ({}))
    const patch: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const name = optionalString(body.name)
      if (!name) return Response.json({ error: 'name must be a non-empty string' }, { status: 400 })
      patch.name = name
    }
    if (body.website !== undefined) patch.website = optionalString(body.website)
    if (body.industry !== undefined) patch.industry = optionalString(body.industry)
    if (body.status !== undefined) patch.status = parseAccountStatus(body.status)
    if (body.channel !== undefined) patch.channel = optionalString(body.channel)
    if (body.source !== undefined) patch.source = optionalString(body.source)
    if (body.address_line1 !== undefined) patch.address_line1 = optionalString(body.address_line1)
    if (body.address_line2 !== undefined) patch.address_line2 = optionalString(body.address_line2)
    if (body.city !== undefined) patch.city = optionalString(body.city)
    if (body.postcode !== undefined) patch.postcode = optionalString(body.postcode)
    if (body.country !== undefined) patch.country = optionalString(body.country)
    if (body.notes !== undefined) patch.notes = optionalString(body.notes)
    if (body.tags !== undefined) patch.tags = parseTags(body.tags) ?? []
    if (body.workstream !== undefined) {
      const slug = optionalString(body.workstream)
      patch.workstream_id = slug ? (await getWorkstreamBySlug(slug)).id : null
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'No changes supplied' }, { status: 400 })
    }

    const { data, error } = await supabaseService.from('accounts').update(patch).eq('id', id).select(ACCOUNT_SELECT).single()
    if (error) throw error

    const { contacts, openTasks } = await accountCounts([id])
    return Response.json(
      formatAccount(data as never, { contacts: contacts.get(id) ?? 0, open_tasks: openTasks.get(id) ?? 0 })
    )
  } catch (error) {
    return jsonError(error, 'Failed to update account')
  }
}
