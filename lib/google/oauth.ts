import { google } from 'googleapis'
import type { GoogleTokens } from '@/lib/types'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
]

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

export function getAuthUrl() {
  const client = getOAuthClient()

  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })
}

export async function getTokensFromCode(code: string) {
  const client = getOAuthClient()
  const { tokens } = await client.getToken(code)
  return tokens
}

export async function getAuthenticatedClient() {
  const { createClient } = await import('@/lib/supabase/service')
  const supabase = createClient()

  const { data: tokenRow, error } = await supabase
    .from('google_tokens')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single<GoogleTokens>()

  if (error || !tokenRow) {
    throw new Error('No Google account connected')
  }

  const client = getOAuthClient()
  client.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expiry_date: tokenRow.expiry_date,
  })

  client.on('tokens', async (tokens) => {
    const nextAccessToken = tokens.access_token ?? tokenRow.access_token
    const nextRefreshToken = tokens.refresh_token ?? tokenRow.refresh_token
    const nextTokenType = tokens.token_type ?? tokenRow.token_type
    const nextScope = tokens.scope ?? tokenRow.scope
    const nextExpiryDate = tokens.expiry_date ?? tokenRow.expiry_date

    await supabase
      .from('google_tokens')
      .update({
        access_token: nextAccessToken,
        refresh_token: nextRefreshToken,
        token_type: nextTokenType,
        scope: nextScope,
        expiry_date: nextExpiryDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokenRow.id)
  })

  return client
}
