import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  CONTACT_SELECT,
  formatContact,
  getWorkstreamBySlug,
  jsonError,
  optionalString,
  parseContactStatus,
  parseLimit,
  requiredString,
} from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const workstreamSlug = searchParams.get('workstream')
    const statusParam = searchParams.get('status')
    const search = searchParams.get('search')?.trim() ?? ''
    const accountId = searchParams.get('account_id')
    const limit = parseLimit(searchParams.get('limit'), 50, 200)
    const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null

    let query = supabaseService
      .from('contacts')
      .select(CONTACT_SELECT)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (workstream) {
      query = query.eq('workstream_id', workstream.id)
    }

    if (statusParam) {
      query = query.eq('status', parseContactStatus(statusParam, statusParam))
    }

    if (accountId) {
      query = query.eq('account_id', accountId)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return Response.json((data ?? []).map((row) => formatContact(row as never)))
  } catch (error) {
    return jsonError(error, 'Failed to load contacts')
  }
}

export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const workstreamSlug = optionalString(body.workstream)
    const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null

    const { data, error } = await supabaseService
      .from('contacts')
      .insert({
        name: requiredString(body.name, 'name'),
        company: optionalString(body.company),
        email: optionalString(body.email),
        phone: optionalString(body.phone),
        role: optionalString(body.role),
        workstream_id: workstream?.id ?? null,
        account_id: optionalString(body.account_id),
        status: parseContactStatus(body.status),
        notes: optionalString(body.notes),
      })
      .select(CONTACT_SELECT)
      .single()

    if (error) {
      throw error
    }

    return Response.json(formatContact(data as never), { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create contact')
  }
}
