import { getAuthenticatedSupabase } from '@/lib/api/auth'
import * as deals from '@/lib/db/deals'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const { id } = await params
    const deal = await deals.getDeal(id, supabase)
    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    return NextResponse.json({ deal })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch deal'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const { id } = await params
    const body = await request.json()
    const saved = await deals.upsertDeal({ ...body, id }, supabase)
    const deal = (await deals.getDeal(saved.id, supabase)) ?? saved

    return NextResponse.json({ deal })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update deal'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const { id } = await params
    await deals.deleteDeal(id, supabase)

    return NextResponse.json({})
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete deal'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
