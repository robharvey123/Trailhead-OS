import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params
    const { data, error } = await supabase
      .from('engagement_documents')
      .select('*')
      .eq('engagement_id', id)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return NextResponse.json({ documents: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load documents' }, { status: 500 })
  }
}

// POST { type?, title, body_markdown, week_start? }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params
    const body = await request.json()
    const { data, error } = await supabase
      .from('engagement_documents')
      .insert({
        engagement_id: id,
        type: body.type ?? 'weekly_update',
        title: body.title ?? null,
        body_markdown: body.body_markdown ?? null,
        week_start: body.week_start ?? null,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ document: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save document' }, { status: 500 })
  }
}
