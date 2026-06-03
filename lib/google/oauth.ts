import { google } from 'googleapis'
import type { GoogleTokens } from '@/lib/types'
import { decryptToken, encryptToken, tokenEncryptionReady } from '@/lib/crypto/tokens'

/** The usable (plaintext) refresh token for a row: decrypt the encrypted column
 *  when present + a key is configured, else fall back to the legacy plaintext. */
function resolveRefreshToken(
  row: Pick<GoogleTokens, 'refresh_token' | 'refresh_token_encrypted'>
): string | undefined {
  if (row.refresh_token_encrypted && tokenEncryptionReady()) {
    try {
      return decryptToken(row.refresh_token_encrypted)
    } catch {
      /* fall back to plaintext below */
    }
  }
  return row.refresh_token ?? undefined
}

/** Storage fields for a new/rotated refresh token: encrypted (plaintext cleared)
 *  when a key is configured, else legacy plaintext. Exported for the callback +
 *  backfill route so all write paths encrypt consistently. */
export function refreshTokenStorage(plain: string): Record<string, unknown> {
  if (tokenEncryptionReady()) return { refresh_token_encrypted: encryptToken(plain), refresh_token: null }
  return { refresh_token: plain }
}

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
]

// Restrict the OAuth flow to the Trailhead Workspace identity.
const HOSTED_DOMAIN = 'trailheadholdings.uk'

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
    hd: HOSTED_DOMAIN,
    include_granted_scopes: true,
  })
}

export async function getTokensFromCode(code: string) {
  const client = getOAuthClient()
  const { tokens } = await client.getToken(code)
  return tokens
}

export async function getAuthenticatedClient(tokenId?: string) {
  const { createClient } = await import('@/lib/supabase/service')
  const supabase = createClient()

  let query = supabase.from('google_tokens').select('*')

  if (tokenId) {
    query = query.eq('id', tokenId)
  } else {
    query = query.order('created_at', { ascending: false }).limit(1)
  }

  const { data: tokenRow, error } = await query.single<GoogleTokens>()

  if (error || !tokenRow) {
    throw new Error('No Google account connected')
  }

  const client = getOAuthClient()
  client.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: resolveRefreshToken(tokenRow),
    expiry_date: tokenRow.expiry_date,
  })

  client.on('tokens', async (tokens) => {
    const update: Record<string, unknown> = {
      access_token: tokens.access_token ?? tokenRow.access_token,
      token_type: tokens.token_type ?? tokenRow.token_type,
      scope: tokens.scope ?? tokenRow.scope,
      expiry_date: tokens.expiry_date ?? tokenRow.expiry_date,
      updated_at: new Date().toISOString(),
    }
    // Only re-store the refresh token when Google issues a new one (rare).
    if (tokens.refresh_token) Object.assign(update, refreshTokenStorage(tokens.refresh_token))

    await supabase.from('google_tokens').update(update).eq('id', tokenRow.id)
  })

  return client
}

export async function getAllGoogleTokens(): Promise<GoogleTokens[]> {
  const { createClient } = await import('@/lib/supabase/service')
  const supabase = createClient()

  const { data, error } = await supabase
    .from('google_tokens')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Failed to load Google accounts')
  }

  return (data ?? []) as GoogleTokens[]
}

export async function getAuthenticatedClientForToken(tokenRow: GoogleTokens) {
  const { createClient } = await import('@/lib/supabase/service')
  const supabase = createClient()

  const client = getOAuthClient()
  client.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: resolveRefreshToken(tokenRow),
    expiry_date: tokenRow.expiry_date,
  })

  client.on('tokens', async (tokens) => {
    const update: Record<string, unknown> = {
      access_token: tokens.access_token ?? tokenRow.access_token,
      token_type: tokens.token_type ?? tokenRow.token_type,
      scope: tokens.scope ?? tokenRow.scope,
      expiry_date: tokens.expiry_date ?? tokenRow.expiry_date,
      updated_at: new Date().toISOString(),
    }
    if (tokens.refresh_token) Object.assign(update, refreshTokenStorage(tokens.refresh_token))

    await supabase.from('google_tokens').update(update).eq('id', tokenRow.id)
  })

  return client
}
