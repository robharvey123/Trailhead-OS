import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/service'
import {
  GSC_SCOPE,
  getAllGoogleTokens,
  getAuthenticatedClientForToken,
  markTokenNeedsReconnect,
  tokenHasScope,
} from '@/lib/google/oauth'
import type { SeoSite } from '@/lib/types'

/**
 * Google Search Console → seo_keywords sync (Growth module).
 *
 * Daily pull of the last 90 days, dimensions query+page, aggregated to keyword
 * level and upserted on (site_id, keyword). GSC reports with a 2-3 day lag and
 * returns nothing for freshly verified properties — an empty result is a valid
 * sync, not an error.
 */

const LOOKBACK_DAYS = 90
const ROW_LIMIT = 25000
const CHUNK = 500

interface QueryTotals {
  impressions: number
  clicks: number
  positionWeighted: number // sum(position × impressions), for a weighted average
}

/** The most recent Google grant that covers Search Console. Flags the newest
 *  account for reconnect (surfacing the existing banner) when none does. */
async function gscAuthClient() {
  const tokens = await getAllGoogleTokens()
  if (tokens.length === 0) throw new Error('No Google account connected')

  const withScope = [...tokens].reverse().find((row) => tokenHasScope(row, GSC_SCOPE))
  if (!withScope) {
    const newest = tokens[tokens.length - 1]
    await markTokenNeedsReconnect(newest.id, `missing_scope:${GSC_SCOPE}`)
    throw new Error(
      'The connected Google account has not granted Search Console access — reconnect Google to grant the new scope'
    )
  }
  return getAuthenticatedClientForToken(withScope)
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export interface GscSyncResult {
  site: string
  rows: number
  keywords: number
  inserted: number
  updated: number
}

export async function syncSiteGsc(site: SeoSite): Promise<GscSyncResult> {
  if (!site.gsc_property) {
    throw new Error(`Site ${site.domain} has no gsc_property configured`)
  }

  const auth = await gscAuthClient()
  const searchconsole = google.searchconsole({ version: 'v1', auth })

  const [{ data }, { data: dailyData }] = await Promise.all([
    searchconsole.searchanalytics.query({
      siteUrl: site.gsc_property,
      requestBody: {
        startDate: isoDaysAgo(LOOKBACK_DAYS),
        endDate: isoDaysAgo(0),
        dimensions: ['query', 'page'],
        rowLimit: ROW_LIMIT,
      },
    }),
    // Site-level daily totals — powers the command centre's 28-day cards and sparklines.
    searchconsole.searchanalytics.query({
      siteUrl: site.gsc_property,
      requestBody: {
        startDate: isoDaysAgo(LOOKBACK_DAYS),
        endDate: isoDaysAgo(0),
        dimensions: ['date'],
        rowLimit: LOOKBACK_DAYS + 1,
      },
    }),
  ])

  const rows = data.rows ?? []

  // Aggregate page-level rows to one entry per query (position weighted by impressions).
  const byQuery = new Map<string, QueryTotals>()
  for (const row of rows) {
    const query = row.keys?.[0]?.trim().toLowerCase()
    if (!query) continue
    const impressions = row.impressions ?? 0
    const totals = byQuery.get(query) ?? { impressions: 0, clicks: 0, positionWeighted: 0 }
    totals.impressions += impressions
    totals.clicks += row.clicks ?? 0
    totals.positionWeighted += (row.position ?? 0) * impressions
    byQuery.set(query, totals)
  }

  const supabase = createClient()
  const now = new Date().toISOString()

  const { data: existing, error: existingError } = await supabase
    .from('seo_keywords')
    .select('id, keyword')
    .eq('site_id', site.id)
  if (existingError) throw new Error(existingError.message)
  const existingByKeyword = new Map((existing ?? []).map((k) => [k.keyword as string, k.id as string]))

  const updates: Array<Record<string, unknown>> = []
  const inserts: Array<Record<string, unknown>> = []
  for (const [keyword, totals] of byQuery) {
    const gscFields = {
      gsc_impressions: totals.impressions,
      gsc_clicks: totals.clicks,
      gsc_position: totals.impressions > 0
        ? Math.round((totals.positionWeighted / totals.impressions) * 10) / 10
        : null,
      last_refreshed_at: now,
    }
    const id = existingByKeyword.get(keyword)
    if (id) {
      // Update path: only the listed columns change; source/volume stay as-is.
      updates.push({ id, site_id: site.id, keyword, ...gscFields })
    } else {
      inserts.push({ site_id: site.id, keyword, source: 'gsc', ...gscFields })
    }
  }

  for (let i = 0; i < updates.length; i += CHUNK) {
    const { error } = await supabase.from('seo_keywords').upsert(updates.slice(i, i + CHUNK))
    if (error) throw new Error(error.message)
  }
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const { error } = await supabase.from('seo_keywords').insert(inserts.slice(i, i + CHUNK))
    if (error) throw new Error(error.message)
  }

  const dailyRows = (dailyData.rows ?? [])
    .filter((row) => row.keys?.[0])
    .map((row) => ({
      site_id: site.id,
      date: row.keys![0],
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      position: row.position != null ? Math.round(row.position * 10) / 10 : null,
    }))
  for (let i = 0; i < dailyRows.length; i += CHUNK) {
    const { error } = await supabase
      .from('seo_gsc_daily')
      .upsert(dailyRows.slice(i, i + CHUNK), { onConflict: 'site_id,date' })
    if (error) throw new Error(error.message)
  }

  await supabase.from('seo_sites').update({ last_gsc_sync_at: now }).eq('id', site.id)

  return {
    site: site.domain,
    rows: rows.length,
    keywords: byQuery.size,
    inserted: inserts.length,
    updated: updates.length,
  }
}

/** Cron entry point — sync every site with a GSC property; never let one site's
 *  failure stop the rest. */
export async function syncAllGscSites(): Promise<{
  synced: GscSyncResult[]
  errors: Array<{ site: string; error: string }>
}> {
  const supabase = createClient()
  const { data: sites, error } = await supabase
    .from('seo_sites')
    .select('*')
    .not('gsc_property', 'is', null)
  if (error) throw new Error(error.message)

  const synced: GscSyncResult[] = []
  const errors: Array<{ site: string; error: string }> = []
  for (const site of (sites ?? []) as SeoSite[]) {
    try {
      synced.push(await syncSiteGsc(site))
    } catch (err) {
      errors.push({ site: site.domain, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return { synced, errors }
}
