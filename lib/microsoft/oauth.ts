import type { MicrosoftTokens } from '@/lib/types'
import { supabaseService } from '@/lib/supabase/service'

const TENANT = 'common' // supports personal + work/school accounts
const AUTH_BASE = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`

const SCOPES = [
  'openid',
  'email',
  'profile',
  'offline_access',
  'Calendars.ReadWrite',
]

function getClientId() {
  return process.env.MICROSOFT_CLIENT_ID!
}

function getClientSecret() {
  return process.env.MICROSOFT_CLIENT_SECRET!
}

function getRedirectUri() {
  return process.env.MICROSOFT_REDIRECT_URI!
}

export function getMicrosoftAuthUrl() {
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    response_mode: 'query',
    scope: SCOPES.join(' '),
    prompt: 'consent',
  })
  return `${AUTH_BASE}/authorize?${params}`
}

export async function exchangeCodeForTokens(code: string) {
  const response = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      code,
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
      scope: SCOPES.join(' '),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  const data = await response.json()
  return {
    access_token: data.access_token as string,
    refresh_token: data.refresh_token as string,
    token_type: (data.token_type ?? 'Bearer') as string,
    expires_in: data.expires_in as number,
    scope: data.scope as string,
  }
}

export async function refreshAccessToken(tokenRow: MicrosoftTokens): Promise<MicrosoftTokens> {
  const response = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      refresh_token: tokenRow.refresh_token,
      grant_type: 'refresh_token',
      scope: SCOPES.join(' '),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  const data = await response.json()
  const expiryDate = Date.now() + (data.expires_in as number) * 1000

  const updated = {
    ...tokenRow,
    access_token: data.access_token as string,
    refresh_token: (data.refresh_token as string) ?? tokenRow.refresh_token,
    expiry_date: expiryDate,
    scope: (data.scope as string) ?? tokenRow.scope,
  }

  await supabaseService
    .from('microsoft_tokens')
    .update({
      access_token: updated.access_token,
      refresh_token: updated.refresh_token,
      expiry_date: updated.expiry_date,
      scope: updated.scope,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tokenRow.id)

  return updated
}

export async function getAuthenticatedToken(tokenId?: string): Promise<MicrosoftTokens> {
  let query = supabaseService.from('microsoft_tokens').select('*')

  if (tokenId) {
    query = query.eq('id', tokenId)
  } else {
    query = query.order('created_at', { ascending: false }).limit(1)
  }

  const { data: tokenRow, error } = await query.single<MicrosoftTokens>()

  if (error || !tokenRow) {
    throw new Error('No Microsoft account connected')
  }

  // Refresh if expired (or within 5 minutes of expiry)
  if (tokenRow.expiry_date && tokenRow.expiry_date < Date.now() + 5 * 60 * 1000) {
    return refreshAccessToken(tokenRow)
  }

  return tokenRow
}

export async function getAllMicrosoftTokens(): Promise<MicrosoftTokens[]> {
  const { data, error } = await supabaseService
    .from('microsoft_tokens')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Failed to load Microsoft accounts')
  }

  return (data ?? []) as MicrosoftTokens[]
}

export async function getUserEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch Microsoft user profile')
  }

  const data = await response.json()
  return (data.mail ?? data.userPrincipalName) as string
}
