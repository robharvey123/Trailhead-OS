import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/auth/safe-next'

const VALID_TYPES: ReadonlySet<EmailOtpType> = new Set(['invite', 'magiclink', 'recovery', 'email'])

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && VALID_TYPES.has(value as EmailOtpType)
}

/**
 * GET /auth/confirm deliberately does NOT verify the token. Mail security
 * scanners (Microsoft Safe Links, Gmail and others) pre-fetch every link in an
 * email, and a GET that called verifyOtp would burn the one-time token before
 * the person clicked. GET only bounces to /auth/accept, which renders a button;
 * the token is spent on the POST below, which scanners do not make.
 * (Same pattern as Engineer OS /api/auth/confirm.)
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  return NextResponse.redirect(new URL(`/auth/accept?${url.searchParams.toString()}`, url.origin))
}

/** POST /auth/confirm: verify the token, set the session cookies, 303 to next. */
export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url)
  const form = await request.formData()
  const tokenHash = String(form.get('token_hash') ?? '')
  const type = String(form.get('type') ?? '') || null
  const next = safeNextPath(String(form.get('next') ?? ''), '/')

  if (!tokenHash || !isEmailOtpType(type)) {
    return NextResponse.redirect(`${origin}/login?error=link_invalid`, 303)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=link_expired`, 303)
  }
  return NextResponse.redirect(`${origin}${next}`, 303)
}
