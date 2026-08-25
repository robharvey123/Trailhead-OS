import { google, type searchconsole_v1 } from 'googleapis'
import { createClient } from '@/lib/supabase/service'
import {
  GSC_SCOPE,
  getAllGoogleTokens,
  getAuthenticatedClientForToken,
  markTokenNeedsReconnect,
  tokenHasScope,
} from '@/lib/google/oauth'
import { refreshRankingUrls } from '@/lib/growth/pages'
import type { SeoSite } from '@/lib/types'

/**
 * Google Search Console → Growth module sync.
 *
 * Three pulls per site per night:
 *  1. query+page over 90 days, aggregated to one row per query → seo_keywords
 *     (the cheap read path for the keyword table; unchanged).
 *  2. date only → seo_gsc_daily (site-level sparklines).
 *  3. date+query+page → seo_gsc_query_page, the history table that makes
 *     cannibalisation, decay and per-keyword rank movement possible. GSC
 *     finalises data ~3 days late, so each run re-pulls the last 5 days and
 *     upserts over them; the first run backfills 90 days in date chunks
 *     (guarded by seo_sites.last_gsc_backfill_at so it happens once).
 *
 * GSC returns nothing for freshly verified properties — an empty result is a
 * valid sync, not an error.
 */

const LOOKBACK_DAYS = 90
const ROW_LIMIT = 25000
const CHUNK = 500
const INCREMENTAL_DAYS = 5
const BACKFILL_DAYS = 90
const BACKFILL_CHUNK_DAYS = 7
const RETENTION_MONTHS = 16

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
  queryPageRows: number
  backfilled: boolean
  rankingUrls: number
}

type Supabase = ReturnType<typeof createClient>

/** One date+query+page pull, paged past rowLimit with startRow. */
async function pullQueryPage(
  searchconsole: searchconsole_v1.Searchconsole,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<searchconsole_v1.Schema$ApiDataRow[]> {
  const rows: searchconsole_v1.Schema$ApiDataRow[] = []
  let startRow = 0
  for (let page = 0; page < 8; page++) {
    const { data } = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['date', 'query', 'page'],
        rowLimit: ROW_LIMIT,
        startRow,
      },
    })
    const batch = data.rows ?? []
    rows.push(...batch)
    if (batch.length < ROW_LIMIT) break
    startRow += ROW_LIMIT
  }
  return rows
}

async function upsertQueryPage(
  supabase: Supabase,
  siteId: string,
  rows: searchconsole_v1.Schema$ApiDataRow[]
): Promise<number> {
  const records = rows
    .filter((row) => row.keys && row.keys.length === 3 && row.keys[1] && row.keys[2])
    .map((row) => ({
      site_id: siteId,
      date: row.keys![0],
      query: row.keys![1].trim().toLowerCase(),
      page: row.keys![2],
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      position: row.position != null ? Math.round(row.position * 10) / 10 : null,
    }))
  // The same (date, query, page) can appear twice only if GSC dedupes
  // differently on case — collapse to be safe before the upsert.
  const byKey = new Map<string, (typeof records)[number]>()
  for (const r of records) {
    const key = `${r.date}|${r.query}|${r.page}`
    const prev = byKey.get(key)
    if (prev) {
      prev.clicks += r.clicks
      prev.impressions += r.impressions
    } else byKey.set(key, r)
  }
  const deduped = [...byKey.values()]
  for (let i = 0; i < deduped.length; i += CHUNK) {
    const { error } = await supabase
      .from('seo_gsc_query_page')
      .upsert(deduped.slice(i, i + CHUNK), { onConflict: 'site_id,date,query,page' })
    if (error) throw new Error(error.message)
  }
  return deduped.length
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

  // ── A2: query × page history ──
  let queryPageRows = 0
  let backfilled = false
  if (!site.last_gsc_backfill_at) {
    // First run: 90 days in 7-day chunks so each request stays under rowLimit.
    for (let start = BACKFILL_DAYS; start > 0; start -= BACKFILL_CHUNK_DAYS) {
      const end = Math.max(0, start - BACKFILL_CHUNK_DAYS + 1)
      const chunkRows = await pullQueryPage(searchconsole, site.gsc_property, isoDaysAgo(start), isoDaysAgo(end))
      queryPageRows += await upsertQueryPage(supabase, site.id, chunkRows)
    }
    backfilled = true
    await supabase.from('seo_sites').update({ last_gsc_backfill_at: now }).eq('id', site.id)
  } else {
    const recent = await pullQueryPage(searchconsole, site.gsc_property, isoDaysAgo(INCREMENTAL_DAYS), isoDaysAgo(0))
    queryPageRows = await upsertQueryPage(supabase, site.id, recent)
  }

  // Prune beyond GSC's own 16-month horizon.
  const cutoff = new Date()
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RETENTION_MONTHS)
  await supabase
    .from('seo_gsc_query_page')
    .delete()
    .eq('site_id', site.id)
    .lt('date', cutoff.toISOString().slice(0, 10))

  // ── D1: keyword → ranking URL cache ──
  const rankingUrls = await refreshRankingUrls(site.id)

  await supabase.from('seo_sites').update({ last_gsc_sync_at: now }).eq('id', site.id)

  return {
    site: site.domain,
    rows: rows.length,
    keywords: byQuery.size,
    inserted: inserts.length,
    updated: updates.length,
    queryPageRows,
    backfilled,
    rankingUrls,
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
