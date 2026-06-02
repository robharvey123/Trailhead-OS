import { getAuthenticatedSupabase } from '@/lib/api/auth'
import * as engagements from '@/lib/db/engagements'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params
    const detail = await engagements.getEngagement(id, supabase)
    if (!detail) return NextResponse.json({ error: 'Engagement not found' }, { status: 404 })
    return NextResponse.json(detail)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load engagement' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params
    const body = await request.json()

    if (body.action === 'pause') { await engagements.pauseEngagement(id, supabase); return NextResponse.json({ ok: true }) }
    if (body.action === 'resume') { await engagements.resumeEngagement(id, supabase); return NextResponse.json({ ok: true }) }
    if (body.action === 'terminate') { await engagements.terminateEngagement(id, body.end_date, supabase); return NextResponse.json({ ok: true }) }

    const engagement = await engagements.upsertEngagement({ ...body, id }, supabase)
    return NextResponse.json({ engagement })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update engagement' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params
    await engagements.deleteEngagement(id, supabase)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete engagement' }, { status: 500 })
  }
}
