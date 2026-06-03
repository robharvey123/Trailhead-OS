import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { addContributor, listContributors } from '@/lib/db/contributors'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params
    const contributors = await listContributors(id, supabase)
    return NextResponse.json({ contributors })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load contributors' }, { status: 500 })
  }
}

// POST { person_id, role?, hourly_rate_gbp } — add a contributor (rate snapshotted)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params
    const body = await request.json()
    if (!body.person_id) return NextResponse.json({ error: 'person_id is required' }, { status: 400 })
    // Rate is required and not-null in the DB; default volunteers to 0 explicitly.
    const rate = body.hourly_rate_gbp == null ? 0 : Number(body.hourly_rate_gbp)
    if (Number.isNaN(rate) || rate < 0) return NextResponse.json({ error: 'hourly_rate_gbp must be a non-negative number' }, { status: 400 })
    const contributor = await addContributor(
      { engagement_id: id, person_id: body.person_id, role: body.role ?? null, hourly_rate_gbp: rate },
      supabase
    )
    return NextResponse.json({ contributor }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to add contributor' }, { status: 500 })
  }
}
