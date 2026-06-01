import { getAuthenticatedSupabase } from '@/lib/api/auth'
import * as savedViews from '@/lib/db/saved-views'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const { id } = await params
    const body = await request.json()

    // Dedicated pin toggle, else general update.
    if ('is_pinned' in body && Object.keys(body).length === 1) {
      const view = await savedViews.pinSavedView(id, body.is_pinned, supabase)
      return NextResponse.json({ view })
    }

    const view = await savedViews.upsertSavedView({ ...body, id }, supabase)
    return NextResponse.json({ view })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update saved view'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const { id } = await params
    await savedViews.deleteSavedView(id, supabase)
    return NextResponse.json({})
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete saved view'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
