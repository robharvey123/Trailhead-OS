import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/roles'
import { exchangeCodeForTokens, storeFreeAgentTokens } from '@/lib/freeagent/client'

export const runtime = 'nodejs'

/** OAuth redirect target: exchange the code and store refreshable credentials. */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  try {
    await requireAdmin(supabase)
  } catch {
    return NextResponse.redirect(new URL('/settings?freeagent=forbidden', request.url))
  }

  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(new URL('/settings?freeagent=error', request.url))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    await storeFreeAgentTokens(tokens)
    return NextResponse.redirect(new URL('/settings?freeagent=connected', request.url))
  } catch (error) {
    console.error('FreeAgent callback error:', error instanceof Error ? error.message : error)
    return NextResponse.redirect(new URL('/settings?freeagent=error', request.url))
  }
}
