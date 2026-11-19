import { NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { canReadQuote } from '@/lib/quotes/os-access'
import { revokeQuoteLink } from '@/lib/quotes/publish'

/** Revoke the client proposal link. The URL then 404s like any bad token. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!(await canReadQuote(auth.supabase, id))) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
  }

  try {
    const { revoked } = await revokeQuoteLink(id)
    return NextResponse.json({ revoked })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to revoke link' }, { status: 500 })
  }
}
