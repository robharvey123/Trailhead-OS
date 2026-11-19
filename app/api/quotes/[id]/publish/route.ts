import { NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { canReadQuote } from '@/lib/quotes/os-access'
import { publishQuote } from '@/lib/quotes/publish'

/**
 * Publish the quote as a client proposal page. Body { regenerate?: true }
 * swaps the token for a new one (the old link stops working at once).
 * 422 with { failures } when the completeness gate fails.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!(await canReadQuote(auth.supabase, id))) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as { regenerate?: unknown }
  try {
    const result = await publishQuote(id, { regenerate: body.regenerate === true })
    if (!result.ok) {
      return NextResponse.json({ error: 'This quote is not ready to publish.', failures: result.failures }, { status: 422 })
    }
    return NextResponse.json({ public_url: result.public_url, already_published: result.already })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to publish' }, { status: 500 })
  }
}
