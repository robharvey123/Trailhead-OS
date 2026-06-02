import { getAuthenticatedSupabase } from '@/lib/api/auth'
import * as engagements from '@/lib/db/engagements'
import { listMilestones } from '@/lib/db/tier1'
import { NextRequest, NextResponse } from 'next/server'

// POST { account_id, performance_fee?, notes? } — add a tier-1 account (+ milestone)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params
    const body = await request.json()
    if (!body.account_id) return NextResponse.json({ error: 'account_id required' }, { status: 400 })
    await engagements.addTier1Account(id, body.account_id, body.performance_fee ?? null, body.notes, supabase)
    const milestones = await listMilestones(id, supabase)
    return NextResponse.json({ milestones }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to add tier-1 account' }, { status: 500 })
  }
}

// DELETE ?account_id=... — remove a tier-1 account (+ milestone)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params
    const accountId = new URL(request.url).searchParams.get('account_id')
    if (!accountId) return NextResponse.json({ error: 'account_id required' }, { status: 400 })
    await engagements.removeTier1Account(id, accountId, supabase)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to remove tier-1 account' }, { status: 500 })
  }
}
