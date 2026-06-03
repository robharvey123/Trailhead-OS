import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { createPerson, listPeople } from '@/lib/db/people'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const activeOnly = new URL(request.url).searchParams.get('active') === '1'
    const people = await listPeople({ activeOnly }, supabase)
    return NextResponse.json({ people })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load people' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const body = await request.json()
    if (!body.full_name || !body.full_name.trim()) {
      return NextResponse.json({ error: 'full_name is required' }, { status: 400 })
    }
    const person = await createPerson(
      {
        full_name: body.full_name,
        email: body.email ?? null,
        default_hourly_rate_gbp: body.default_hourly_rate_gbp ?? null,
      },
      supabase
    )
    return NextResponse.json({ person }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create person' }, { status: 500 })
  }
}
