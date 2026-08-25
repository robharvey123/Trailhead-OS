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
  // Meet conference records + transcripts, and the Gemini "take notes for me"
  // summary Doc (in the organiser's Drive). Incremental consent (include_granted_scopes
  // + prompt:'consent' below) means reconnecting Google once grants these additively.
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
  // Search Console (Growth module GSC sync). Read-only; granted on next reconnect.
  'https://www.googleapis.com/auth/webmasters.readonly',
  // Google Ads (Growth module paid sync). Same reconnect flow as GSC: a token
  // issued before this line lacks the scope until Google is reconnected.
  'https://www.googleapis.com/auth/adwords',
]

export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
export const ADS_SCOPE = 'https://www.googleapis.com/auth/adwords'

/**
 * Whether a stored grant covers a scope. Google returns the granted set as a
 * space-delimited string; a scope added to SCOPES after a token was issued is
 * NOT retroactively granted — API calls fail with a 403 that is not
 * `invalid_grant`, so callers must check this and flag `needs_reconnect`
 * themselves (the reconnect banner then handles re-consent).
 */
export function tokenHasScope(row: Pick<GoogleTokens, 'scope'>, scope: string): boolean {
  return (row.scope ?? '').split(/\s+/).includes(scope)
}

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

/**
 * True when an error is Google's `invalid_grant` — the stored refresh token is
 * revoked / expired / superseded and the account must be reconnected. googleapis
 * surfaces it on `err.response.data.error` (gaxios) or in the message.
 */
export function isInvalidGrant(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { response?: { data?: { error?: string } }; message?: string }
  return e.response?.data?.error === 'invalid_grant' || /invalid_grant/i.test(e.message ?? '')
}

/** Flag a Google account as needing reconnection (service-role write). Never throws. */
export async function markTokenNeedsReconnect(tokenId: string, reason = 'invalid_grant'): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/service')
    const supabase = createClient()
    await supabase
      .from('google_tokens')
      .update({ needs_reconnect: true, auth_error: reason, auth_error_at: new Date().toISOString() })
      .eq('id', tokenId)
  } catch {
    /* best-effort flag — don't let it mask the original error */
  }
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
