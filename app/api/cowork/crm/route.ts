import { NextRequest, NextResponse } from 'next/server'
import {
  getWorkstreamBySlug,
  jsonError,
  mapContact,
  optionalString,
  parseContactStatus,
  requiredString,
  requireCoworkAuth,
} from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const unauthorised = requireCoworkAuth(request)
  if (unauthorised) {
    return unauthorised
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const workstreamSlug = searchParams.get('workstream')
    const statusParam = searchParams.get('status')
    const search = searchParams.get('search')?.trim() ?? ''
    const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null

    let query = supabaseService
      .from('contacts')
      .select('id, workstream_id, name, company, email, phone, role, status, notes, tags, created_at, updated_at, workstreams(slug, label, colour)')
      .order('created_at', { ascending: false })

    if (workstream) {
      query = query.eq('workstream_id', workstream.id)
    }

    if (statusParam) {
      query = query.eq('status', parseContactStatus(statusParam, statusParam))
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json((data ?? []).map((row) => mapContact(row)))
  } catch (error) {
    return jsonError(error, 'Failed to load contacts')
  }
}

export async function POST(request: NextRequest) {
  const unauthorised = requireCoworkAuth(request)
  if (unauthorised) {
    return unauthorised
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
        status: parseContactStatus(body.status),
        notes: optionalString(body.notes),
      })
      .select('id, workstream_id, name, company, email, phone, role, status, notes, tags, created_at, updated_at, workstreams(slug, label, colour)')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(mapContact(data), { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create contact')
  }
}
