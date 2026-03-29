import { NextResponse, type NextRequest } from 'next/server'
import { google } from 'googleapis'
import { getOAuthClient, getTokensFromCode } from '@/lib/google/oauth'
import { createClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/settings?google=error', request.url))
  }

  try {
    const tokens = await getTokensFromCode(code)
    const client = getOAuthClient()
    client.setCredentials(tokens)

    const oauth2 = google.oauth2({ auth: client, version: 'v2' })
    const { data: userInfo } = await oauth2.userinfo.get()
    const email = userInfo.email

    if (!email || !tokens.access_token || !tokens.refresh_token) {
      throw new Error('Google OAuth response was missing required fields')
    }

    const supabase = createClient()

    const { error: deleteError } = await supabase.from('google_tokens').delete().neq('id', '')
    if (deleteError) {
      throw deleteError
    }

    const { error: insertError } = await supabase.from('google_tokens').insert({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type ?? 'Bearer',
      expiry_date: tokens.expiry_date ?? null,
      scope: tokens.scope ?? null,
      email,
    })

    if (insertError) {
      throw insertError
    }

    return NextResponse.redirect(new URL('/settings?google=connected', request.url))
  } catch {
    return NextResponse.redirect(new URL('/settings?google=error', request.url))
  }
}
