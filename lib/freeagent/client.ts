import { createClient } from '@/lib/supabase/service'
import { decryptToken, encryptToken, tokenEncryptionReady } from '@/lib/crypto/tokens'

// BASE includes the /v2 suffix (e.g. https://api.freeagent.com/v2). Sandbox:
// https://api.sandbox.freeagent.com/v2. approve_app + token_endpoint hang off it.
const BASE = process.env.FREEAGENT_BASE_URL ?? 'https://api.freeagent.com/v2'
const CLIENT_ID = process.env.FREEAGENT_CLIENT_ID
const CLIENT_SECRET = process.env.FREEAGENT_CLIENT_SECRET
const REDIRECT_URI = process.env.FREEAGENT_REDIRECT_URI

// Refresh when the token is this close to (or past) expiry.
const REFRESH_SKEW_MS = 2 * 60 * 1000

type FreeAgentRow = {
  id: string
  access_token: string
  refresh_token: string | null
  refresh_token_encrypted: string | null
  expires_at: string
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type?: string
}

function requireOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error('FreeAgent is not configured. Set FREEAGENT_CLIENT_ID, FREEAGENT_CLIENT_SECRET and FREEAGENT_REDIRECT_URI.')
  }
  return { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, redirectUri: REDIRECT_URI }
}

/** The consent URL to send the admin to. */
export function getFreeAgentAuthUrl(): string {
  const { clientId, redirectUri } = requireOAuthConfig()
  const params = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri })
  return `${BASE}/approve_app?${params.toString()}`
}

function basicAuthHeader(): string {
  const { clientId, clientSecret } = requireOAuthConfig()
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
}

async function tokenRequest(form: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${BASE}/token_endpoint`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(form).toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`FreeAgent token request failed (${res.status}): ${text.slice(0, 300)}`)
  }
  return (await res.json()) as TokenResponse
}

/** Exchange an authorization code for tokens (called from the OAuth callback). */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const { redirectUri } = requireOAuthConfig()
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
}

function refreshTokenStorage(plain: string): Record<string, unknown> {
  if (tokenEncryptionReady()) return { refresh_token_encrypted: encryptToken(plain), refresh_token: null }
  return { refresh_token_encrypted: null, refresh_token: plain }
}

function resolveRefreshToken(row: FreeAgentRow): string | null {
  if (row.refresh_token_encrypted && tokenEncryptionReady()) {
    try {
      return decryptToken(row.refresh_token_encrypted)
    } catch {
      return row.refresh_token
    }
  }
  return row.refresh_token
}

/** Persist tokens after the initial exchange (single-row upsert, service role). */
export async function storeFreeAgentTokens(tokens: TokenResponse): Promise<void> {
  if (!tokens.refresh_token) throw new Error('FreeAgent did not return a refresh token.')
  const supabase = createClient()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const { data: existing } = await supabase.from('freeagent_credentials').select('id').limit(1).maybeSingle()
  const payload = {
    access_token: tokens.access_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
    ...refreshTokenStorage(tokens.refresh_token),
  }
  if (existing) {
    const { error } = await supabase.from('freeagent_credentials').update(payload).eq('id', existing.id)
    if (error) throw new Error(error.message || 'Failed to store FreeAgent tokens')
  } else {
    const { error } = await supabase.from('freeagent_credentials').insert(payload)
    if (error) throw new Error(error.message || 'Failed to store FreeAgent tokens')
  }
}

/** Is FreeAgent connected (a credential row exists)? */
export async function freeAgentConnected(): Promise<boolean> {
  const supabase = createClient()
  const { data } = await supabase.from('freeagent_credentials').select('id').limit(1).maybeSingle()
  return Boolean(data)
}

/**
 * Return a valid access token, refreshing (and re-storing) when it's within the
 * skew window of expiry. Throws if FreeAgent isn't connected.
 */
export async function getFreeAgentToken(): Promise<string> {
  const supabase = createClient()
  const { data: row } = await supabase
    .from('freeagent_credentials')
    .select('id, access_token, refresh_token, refresh_token_encrypted, expires_at')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!row) throw new Error('FreeAgent is not connected.')

  const credential = row as FreeAgentRow
  const expiresMs = new Date(credential.expires_at).getTime()
  if (expiresMs - Date.now() > REFRESH_SKEW_MS) {
    return credential.access_token
  }

  const refreshToken = resolveRefreshToken(credential)
  if (!refreshToken) throw new Error('FreeAgent refresh token missing. Reconnect FreeAgent.')

  const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
  const update: Record<string, unknown> = {
    access_token: tokens.access_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }
  // FreeAgent may or may not rotate the refresh token; only re-store if it did.
  if (tokens.refresh_token) Object.assign(update, refreshTokenStorage(tokens.refresh_token))
  await supabase.from('freeagent_credentials').update(update).eq('id', credential.id)

  return tokens.access_token
}

/** Authenticated fetch against the FreeAgent API. `path` starts with "/". */
export async function faFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getFreeAgentToken()
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  })
}
