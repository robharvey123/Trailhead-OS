import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const next = requestUrl.searchParams.get('next') ?? '/analytics'
  const emailOtpTypes = ['magiclink', 'recovery', 'invite', 'email'] as const
  const otpType = emailOtpTypes.includes(type as typeof emailOtpTypes[number])
    ? (type as (typeof emailOtpTypes)[number])
    : null

  const response = NextResponse.redirect(new URL(next, request.url))
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  } else if (tokenHash && otpType) {
    await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    })
  }

  return response
}
