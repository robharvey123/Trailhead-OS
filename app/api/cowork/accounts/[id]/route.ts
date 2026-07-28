import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  ACCOUNT_SELECT,
  accountCounts,
  formatAccount,
  getAccountById,
  getWorkstreamBySlug,
  jsonError,
  optionalNumber,
  optionalString,
  parseAccountStatus,
  parseTags,
} from '@/lib/cowork-api'
import { recordCoworkWrite } from '@/lib/cowork-audit'
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
    if (body.default_hourly_rate !== undefined) patch.default_hourly_rate = optionalNumber(body.default_hourly_rate, 'default_hourly_rate')
    if (body.hq_address !== undefined) patch.hq_address = optionalString(body.hq_address)
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
    const account = formatAccount(data as never, { contacts: contacts.get(id) ?? 0, open_tasks: openTasks.get(id) ?? 0 })
    void recordCoworkWrite({
      action: 'update',
      entity: 'account',
      entityId: account.id,
      entityLabel: account.name,
      summary: `Updated account "${account.name}" (${Object.keys(patch).join(', ')})`,
      payload: body,
    })
    return Response.json(account)
  } catch (error) {
    return jsonError(error, 'Failed to update account')
  }
}

// DELETE — hard-delete an account, but only when nothing references it. Every
// reference is an EXPLICIT count (service role bypasses RLS, and a try/catch on an
// FK error can't be trusted: some of these FKs are ON DELETE SET NULL and would
// silently orphan the row rather than error). Blocked references return 409 with a
// blocked_by breakdown; the delete only proceeds when every count is zero. This is
// the cleanup path for a duplicate created in error.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }
  try {
    const { id } = await params
    const account = await getAccountById(id) // 404 if missing

    const count = async (table: string, column: string, selectCol = 'id') => {
      const { count: n, error } = await supabaseService
        .from(table)
        .select(selectCol, { count: 'exact', head: true })
        .eq(column, id)
      if (error) throw error
      return n ?? 0
    }

    // Invoices are counted regardless of soft-delete: even a soft-deleted invoice
    // still references the account, and this must never be able to orphan one.
    const [invoices, contacts, projects, tasks, timeEntries, engEnd, engBilled, tier1] = await Promise.all([
      count('invoices', 'account_id'),
      count('contacts', 'account_id'),
      count('projects', 'account_id'),
      count('tasks', 'account_id'),
      count('time_entries', 'account_id'),
      count('engagements', 'end_client_account_id'),
      count('engagements', 'billed_via_account_id'),
      count('engagement_tier1_accounts', 'account_id', 'account_id'),
    ])

    const allBlockers: Record<string, number> = {
      invoices,
      contacts,
      projects,
      tasks,
      time_entries: timeEntries,
      engagements_end_client: engEnd,
      engagements_billed_via: engBilled,
      tier1_accounts: tier1,
    }
    const blocked_by = Object.fromEntries(Object.entries(allBlockers).filter(([, n]) => n > 0))

    if (Object.keys(blocked_by).length > 0) {
      return Response.json(
        { error: 'Account is referenced and cannot be deleted', blocked_by },
        { status: 409 }
      )
    }

    const { error } = await supabaseService.from('accounts').delete().eq('id', id)
    if (error) throw error
    void recordCoworkWrite({
      action: 'delete',
      entity: 'account',
      entityId: id,
      entityLabel: account.name,
      summary: `Deleted account "${account.name}" (had no references)`,
    })
    return Response.json({ ok: true, deleted: id })
  } catch (error) {
    return jsonError(error, 'Failed to delete account')
  }
}
