import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/roles'
import { getFreeAgentAuthUrl } from '@/lib/freeagent/client'

export const runtime = 'nodejs'

/** Kick off the FreeAgent OAuth flow. Admin-only — this binds the whole company's
 *  accounting connection, so a random logged-in user must not be able to rebind it. */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  try {
    await requireAdmin(supabase)
  } catch {
    return NextResponse.redirect(new URL('/settings?freeagent=forbidden', request.url))
  }
  try {
    return NextResponse.redirect(getFreeAgentAuthUrl())
  } catch {
    return NextResponse.redirect(new URL('/settings?freeagent=config', request.url))
  }
}
