import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import {
  GSC_SCOPE,
  getAllGoogleTokens,
  getAuthenticatedClientForToken,
  tokenHasScope,
} from '@/lib/google/oauth'

/**
 * Read-only diagnostic for the "User does not have sufficient permission for
 * site" case: shows which Google grant the GSC sync would pick, whether that
 * grant actually covers the Search Console scope, and — decisively — the exact
 * property identifiers Google says that account can read. Compare the latter
 * against each site's stored `gsc_property`.
 */
export async function GET() {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response

  const tokens = await getAllGoogleTokens()
  const accounts = tokens.map((row) => ({
    email: row.email,
    hasSearchConsoleScope: tokenHasScope(row, GSC_SCOPE),
    needsReconnect: row.needs_reconnect ?? false,
    scopes: (row.scope ?? '').split(/\s+/).filter(Boolean),
  }))

  const { data: sites } = await auth.supabase
    .from('seo_sites')
    .select('domain, gsc_property')

  // Same selection rule as gscAuthClient(): newest grant that covers the scope.
  const chosen = [...tokens].reverse().find((row) => tokenHasScope(row, GSC_SCOPE))

  if (!chosen) {
    return NextResponse.json({
      chosenAccount: null,
      accounts,
      storedProperties: sites ?? [],
      googleProperties: null,
      note: 'No stored grant covers the Search Console scope — reconnect Google.',
    })
  }

  let googleProperties: unknown = null
  let googleError: string | null = null

  try {
    const client = await getAuthenticatedClientForToken(chosen)
    const searchconsole = google.searchconsole({ version: 'v1', auth: client })
    const { data } = await searchconsole.sites.list()
    googleProperties = (data.siteEntry ?? []).map((entry) => ({
      siteUrl: entry.siteUrl,
      permissionLevel: entry.permissionLevel,
    }))
  } catch (error) {
    googleError = error instanceof Error ? error.message : String(error)
  }

  return NextResponse.json({
    chosenAccount: chosen.email,
    accounts,
    storedProperties: sites ?? [],
    googleProperties,
    googleError,
  })
}
