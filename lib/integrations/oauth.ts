import type { IntegrationProvider } from './types'
import { providerRegistry } from './registry'

interface OAuthParams {
  provider: IntegrationProvider
  workspaceId: string
  redirectUri: string
}

/**
 * Build the OAuth2 authorization URL for a given provider.
 * Each provider has a different authorize endpoint / params.
 */
export function buildAuthUrl({ provider, workspaceId, redirectUri }: OAuthParams): string | null {
  const cfg = providerRegistry[provider]
  if (cfg.authType !== 'oauth2') return null

  const state = encodeURIComponent(JSON.stringify({ provider, workspaceId }))
  const scopes = (cfg.oauthScopes ?? []).join(' ')

  switch (provider) {
    case 'quickbooks': {
      const clientId = process.env.QUICKBOOKS_CLIENT_ID
      if (!clientId) return null
      return `https://appcenter.intuit.com/connect/oauth2?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${state}`
    }
    case 'xero': {
      const clientId = process.env.XERO_CLIENT_ID
      if (!clientId) return null
      return `https://login.xero.com/identity/connect/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${state}`
    }
    case 'slack': {
      const clientId = process.env.SLACK_CLIENT_ID
      if (!clientId) return null
      return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}`
    }
    case 'google': {
      const clientId = process.env.GOOGLE_CLIENT_ID
      if (!clientId) return null
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${state}`
    }
    case 'shopify': {
      // Shopify requires a shop domain; expect it in config later
      return null
    }
    default:
      return null
  }
}

interface TokenExchangeParams {
  provider: IntegrationProvider
  code: string
  redirectUri: string
}

interface TokenResult {
  access_token: string
  refresh_token?: string
  expires_in?: number
  [key: string]: unknown
}

/**
 * Exchange an authorization code for access/refresh tokens.
 */
export async function exchangeCodeForTokens({ provider, code, redirectUri }: TokenExchangeParams): Promise<TokenResult> {
  let tokenUrl: string
  let body: Record<string, string>

  switch (provider) {
    case 'quickbooks':
      tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
      body = { grant_type: 'authorization_code', code, redirect_uri: redirectUri }
      break
    case 'xero':
      tokenUrl = 'https://identity.xero.com/connect/token'
      body = { grant_type: 'authorization_code', code, redirect_uri: redirectUri }
      break
    case 'slack':
      tokenUrl = 'https://slack.com/api/oauth.v2.access'
      body = { code, redirect_uri: redirectUri, client_id: process.env.SLACK_CLIENT_ID!, client_secret: process.env.SLACK_CLIENT_SECRET! }
      break
    case 'google':
      tokenUrl = 'https://oauth2.googleapis.com/token'
      body = { grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET! }
      break
    default:
      throw new Error(`OAuth not supported for ${provider}`)
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' }

  // QuickBooks and Xero use HTTP Basic auth for token exchange
  if (provider === 'quickbooks') {
    headers['Authorization'] = `Basic ${btoa(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`)}`
  } else if (provider === 'xero') {
    headers['Authorization'] = `Basic ${btoa(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`)}`
  }

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: new URLSearchParams(body).toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed for ${provider}: ${text}`)
  }

  return res.json()
}
