import { randomBytes } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, roleIsAdmin } from '@/lib/auth/roles'
import { safeEqual } from '@/lib/auth/safe-equal'

/**
 * CSRF protection and an owner gate for the Google and Microsoft account-connect
 * flows. Both callbacks store tokens with the service role, so without these
 * checks anyone who opened /api/auth/google could attach their own mailbox and
 * calendar to the OS, and the sync crons would then pull it in.
 *
 * Start: an owner/admin session is required, a random `state` is minted and kept
 * in a short-lived httpOnly cookie scoped to /api/auth.
 * Callback: the session is required again and the returned `state` must match the
 * cookie (constant-time). The cookie is cleared either way.
 */
export type OAuthProvider = 'google' | 'microsoft'

const STATE_TTL_SECONDS = 10 * 60

function cookieName(provider: OAuthProvider) {
  return `oauth_state_${provider}`
}

// Scoped to /api/auth (not the provider's own path) so it still reaches the
// callback whatever GOOGLE_REDIRECT_URI / MICROSOFT_REDIRECT_URI point at there.
const COOKIE_PATH = '/api/auth'

async function adminSignedIn(): Promise<boolean> {
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase).catch(() => null)
  return roleIsAdmin(profile?.role)
}

/** Redirect to the provider's consent screen, or to /login when not an owner/admin. */
export async function startOAuth(
  request: NextRequest,
  provider: OAuthProvider,
  buildAuthUrl: (state: string) => string
): Promise<NextResponse> {
  if (!(await adminSignedIn())) {
    const login = new URL('/login', request.url)
    login.searchParams.set('next', '/calendar/integrations')
    return NextResponse.redirect(login)
  }

  const state = randomBytes(32).toString('base64url')
  const response = NextResponse.redirect(buildAuthUrl(state))
  response.cookies.set(cookieName(provider), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Lax so the cookie survives the top-level GET redirect back from the provider.
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: STATE_TTL_SECONDS,
  })
  return response
}

/** True when the callback carries a matching state and an owner/admin session. */
export async function verifyOAuthCallback(request: NextRequest, provider: OAuthProvider): Promise<boolean> {
  const returned = request.nextUrl.searchParams.get('state')
  const expected = request.cookies.get(cookieName(provider))?.value
  if (!safeEqual(returned, expected)) return false
  return adminSignedIn()
}

/** Clear the state cookie on whatever response the callback returns. */
export function clearOAuthState<T extends NextResponse>(response: T, provider: OAuthProvider): T {
  response.cookies.set(cookieName(provider), '', { path: COOKIE_PATH, maxAge: 0 })
  return response
}
