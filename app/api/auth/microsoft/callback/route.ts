import { NextResponse, type NextRequest } from 'next/server'
import { exchangeCodeForTokens, getUserEmail } from '@/lib/microsoft/oauth'
import { createClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/calendar/integrations?microsoft=error', request.url))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    const email = await getUserEmail(tokens.access_token)

    if (!email || !tokens.access_token || !tokens.refresh_token) {
      throw new Error('Microsoft OAuth response was missing required fields')
    }

    const expiryDate = Date.now() + tokens.expires_in * 1000
    const supabase = createClient()

    // Check if this Microsoft account is already connected
    const { data: existing } = await supabase
      .from('microsoft_tokens')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('microsoft_tokens')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_type: tokens.token_type,
          expiry_date: expiryDate,
          scope: tokens.scope,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      const { error: insertError } = await supabase.from('microsoft_tokens').insert({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        expiry_date: expiryDate,
        scope: tokens.scope,
        email,
        label: email,
      })

      if (insertError) {
        throw insertError
      }
    }

    return NextResponse.redirect(new URL('/calendar/integrations?microsoft=connected', request.url))
  } catch {
    return NextResponse.redirect(new URL('/calendar/integrations?microsoft=error', request.url))
  }
}
