import { createClient } from '@/lib/supabase/service'
import { estimatedMonthlyUpside } from '@/lib/growth/ctr'

/**
 * Page-level reads over seo_gsc_query_page (Growth module). Everything that
 * needs to name a URL — the ranking-URL cache (D1), the refresh worksheet
 * (D2), decay and cannibalisation detection (C2), the keyword coverage matrix
 * (C4) — comes through here so the aggregation rules live in one place.
 *
 * Windows: "last 28" is the 28 days ending today; GSC lags ~3 days so the
 * newest rows are always a little thin, which is fine for ratios and rankings.
 */

export const WINDOW_DAYS = 28

type Supabase = ReturnType<typeof createClient>

interface QueryPageRow {
  date: string
  query: string
  page: string
  clicks: number
  impressions: number
  position: number | null
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Paged read — the table can hold tens of thousands of rows per window. */
async function readWindow(
  supabase: Supabase,
  siteId: string,
  fromDaysAgo: number,
  toDaysAgo: number
): Promise<QueryPageRow[]> {
  const rows: QueryPageRow[] = []
  const PAGE = 5000
  for (let offset = 0; offset < 200_000; offset += PAGE) {
    const { data, error } = await supabase
      .from('seo_gsc_query_page')
      .select('date, query, page, clicks, impressions, position')
      .eq('site_id', siteId)
      .gt('date', isoDaysAgo(fromDaysAgo))
      .lte('date', isoDaysAgo(toDaysAgo))
      .order('date', { ascending: false })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as QueryPageRow[]
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}

export interface Agg {
  clicks: number
  impressions: number
  positionWeighted: number
}

function add(agg: Agg | undefined, row: { clicks: number; impressions: number; position: number | null }): Agg {
  const a = agg ?? { clicks: 0, impressions: 0, positionWeighted: 0 }
  a.clicks += row.clicks
  a.impressions += row.impressions
  a.positionWeighted += (row.position ?? 0) * row.impressions
  return a
}

export function avgPosition(agg: Agg): number | null {
  return agg.impressions > 0 ? Math.round((agg.positionWeighted / agg.impressions) * 10) / 10 : null
}

// ── D1: ranking URL per query ────────────────────────────────────────────────

export interface RankingUrl {
  url: string
  clicks: number
  impressions: number
  position: number | null
  /** Share of the query's impressions this page holds, 0-1. */
  share: number
}

/** Per query, the page with the most impressions over the last 28 days. */
export async function rankingUrlsForSite(siteId: string): Promise<Map<string, RankingUrl>> {
  const supabase = createClient()
  const rows = await readWindow(supabase, siteId, WINDOW_DAYS, 0)
  const byQueryPage = new Map<string, Map<string, Agg>>()
  for (const row of rows) {
    const pages = byQueryPage.get(row.query) ?? new Map<string, Agg>()
    pages.set(row.page, add(pages.get(row.page), row))
    byQueryPage.set(row.query, pages)
  }
  const out = new Map<string, RankingUrl>()
  for (const [query, pages] of byQueryPage) {
    let best: [string, Agg] | null = null
    let total = 0
    for (const entry of pages) {
      total += entry[1].impressions
      if (!best || entry[1].impressions > best[1].impressions) best = entry
    }
    if (!best || best[1].impressions === 0) continue
    out.set(query, {
      url: best[0],
      clicks: best[1].clicks,
      impressions: best[1].impressions,
      position: avgPosition(best[1]),
      share: total > 0 ? best[1].impressions / total : 1,
    })
  }
  return out
}

export async function rankingUrlFor(siteId: string, query: string): Promise<RankingUrl | null> {
  const all = await rankingUrlsForSite(siteId)
  return all.get(query.trim().toLowerCase()) ?? null
}

/** Write the cache onto seo_keywords. Returns the number of keywords resolved. */
export async function refreshRankingUrls(siteId: string): Promise<number> {
  const supabase = createClient()
  const ranking = await rankingUrlsForSite(siteId)
  const { data: keywords, error } = await supabase
    .from('seo_keywords')
    .select('id, keyword')
    .eq('site_id', siteId)
  if (error) throw new Error(error.message)
  const now = new Date().toISOString()
  let resolved = 0
  const updates: Array<Record<string, unknown>> = []
  for (const k of keywords ?? []) {
    const hit = ranking.get(k.keyword as string)
    updates.push({
      id: k.id,
      site_id: siteId,
      keyword: k.keyword,
      ranking_url: hit?.url ?? null,
      ranking_url_clicks: hit?.clicks ?? null,
      ranking_url_impressions: hit?.impressions ?? null,
      ranking_url_position: hit?.position ?? null,
      ranking_url_checked_at: now,
    })
    if (hit) resolved += 1
  }
  for (let i = 0; i < updates.length; i += 500) {
    const { error: upErr } = await supabase.from('seo_keywords').upsert(updates.slice(i, i + 500))
    if (upErr) throw new Error(upErr.message)
  }
  return resolved
}

// ── D2: page-level stats ─────────────────────────────────────────────────────

export interface PageQueryStat {
  query: string
  clicks: number
  impressions: number
  position: number | null
  /** Estimated extra clicks/month if this query reached position 3 (CTR model). */
  upside: number
}

export interface PageStats {
  url: string
  clicks: number
  impressions: number
  position: number | null
  prevClicks: number
  prevImpressions: number
  queries: PageQueryStat[]
  /** Queries at position 4-30 sorted by upside. */
  opportunities: PageQueryStat[]
  estimatedUpside: number
}

export async function pageStats(siteId: string, url: string): Promise<PageStats> {
  const supabase = createClient()
  const [current, previous] = await Promise.all([
    readWindow(supabase, siteId, WINDOW_DAYS, 0),
    readWindow(supabase, siteId, WINDOW_DAYS * 2, WINDOW_DAYS),
  ])
  const cur = current.filter((r) => r.page === url)
  const prev = previous.filter((r) => r.page === url)

  const byQuery = new Map<string, Agg>()
  let total: Agg = { clicks: 0, impressions: 0, positionWeighted: 0 }
  for (const row of cur) {
    byQuery.set(row.query, add(byQuery.get(row.query), row))
    total = add(total, row)
  }
  let prevTotal: Agg = { clicks: 0, impressions: 0, positionWeighted: 0 }
  for (const row of prev) prevTotal = add(prevTotal, row)

  const queries: PageQueryStat[] = [...byQuery.entries()]
    .map(([query, agg]) => {
      const position = avgPosition(agg)
      return {
        query,
        clicks: agg.clicks,
        impressions: agg.impressions,
        position,
        upside: estimatedMonthlyUpside(agg.impressions, position, WINDOW_DAYS),
      }
    })
    .sort((a, b) => b.impressions - a.impressions)

  const opportunities = queries
    .filter((q) => q.position !== null && q.position >= 4 && q.position <= 30)
    .sort((a, b) => b.upside - a.upside)

  return {
    url,
    clicks: total.clicks,
    impressions: total.impressions,
    position: avgPosition(total),
    prevClicks: prevTotal.clicks,
    prevImpressions: prevTotal.impressions,
    queries,
    opportunities,
    estimatedUpside: opportunities.reduce((sum, q) => sum + q.upside, 0),
  }
}

/** All pages with traffic in the last 28 days, with totals — the pages index. */
export async function sitePages(siteId: string): Promise<
  Array<{ url: string; clicks: number; impressions: number; position: number | null; queries: number; prevClicks: number }>
> {
  const supabase = createClient()
  const [current, previous] = await Promise.all([
    readWindow(supabase, siteId, WINDOW_DAYS, 0),
    readWindow(supabase, siteId, WINDOW_DAYS * 2, WINDOW_DAYS),
  ])
  const byPage = new Map<string, Agg & { queries: Set<string> }>()
  for (const row of current) {
    const entry = byPage.get(row.page) ?? { clicks: 0, impressions: 0, positionWeighted: 0, queries: new Set<string>() }
    add(entry, row)
    entry.queries.add(row.query)
    byPage.set(row.page, entry)
  }
  const prevByPage = new Map<string, number>()
  for (const row of previous) prevByPage.set(row.page, (prevByPage.get(row.page) ?? 0) + row.clicks)
  return [...byPage.entries()]
    .map(([url, agg]) => ({
      url,
      clicks: agg.clicks,
      impressions: agg.impressions,
      position: avgPosition(agg),
      queries: agg.queries.size,
      prevClicks: prevByPage.get(url) ?? 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
}

// ── C2: decay and cannibalisation ────────────────────────────────────────────

export interface DecayingPage {
  url: string
  clicksNow: number
  clicksThen: number
  dropPct: number
  /** Queries that lost the most impressions, with the delta. */
  losingQueries: Array<{ query: string; impressionsNow: number; impressionsThen: number }>
}

/** Pages whose clicks in the last 28 days fell ≥ `minDropPct` against the 28
 *  days ending 90 days ago, on a baseline of at least `minBaseline` clicks. */
export async function decayingPages(siteId: string, minDropPct = 30, minBaseline = 50): Promise<DecayingPage[]> {
  const supabase = createClient()
  const [now, then] = await Promise.all([
    readWindow(supabase, siteId, WINDOW_DAYS, 0),
    readWindow(supabase, siteId, 90 + WINDOW_DAYS, 90),
  ])
  const nowByPage = new Map<string, { clicks: number; queries: Map<string, number> }>()
  const thenByPage = new Map<string, { clicks: number; queries: Map<string, number> }>()
  const fold = (rows: QueryPageRow[], into: typeof nowByPage) => {
    for (const row of rows) {
      const entry = into.get(row.page) ?? { clicks: 0, queries: new Map<string, number>() }
      entry.clicks += row.clicks
      entry.queries.set(row.query, (entry.queries.get(row.query) ?? 0) + row.impressions)
      into.set(row.page, entry)
    }
  }
  fold(now, nowByPage)
  fold(then, thenByPage)

  const out: DecayingPage[] = []
  for (const [url, before] of thenByPage) {
    if (before.clicks < minBaseline) continue
    const after = nowByPage.get(url) ?? { clicks: 0, queries: new Map<string, number>() }
    const dropPct = Math.round(((before.clicks - after.clicks) / before.clicks) * 100)
    if (dropPct < minDropPct) continue
    const losing = [...before.queries.entries()]
      .map(([query, impressionsThen]) => ({
        query,
        impressionsThen,
        impressionsNow: after.queries.get(query) ?? 0,
      }))
      .sort((a, b) => b.impressionsThen - b.impressionsNow - (a.impressionsThen - a.impressionsNow))
      .slice(0, 5)
    out.push({ url, clicksNow: after.clicks, clicksThen: before.clicks, dropPct, losingQueries: losing })
  }
  return out.sort((a, b) => b.clicksThen - b.clicksNow - (a.clicksThen - a.clicksNow))
}

export interface Cannibalisation {
  query: string
  impressions: number
  pages: Array<{ url: string; clicks: number; impressions: number; share: number; position: number | null }>
}

/** Queries where two or more pages each hold ≥ `minShare` of impressions over
 *  28 days, suppressed where one page holds > `dominantShare`. */
export async function cannibalisedQueries(
  siteId: string,
  minShare = 0.1,
  dominantShare = 0.8,
  minImpressions = 50
): Promise<Cannibalisation[]> {
  const supabase = createClient()
  const rows = await readWindow(supabase, siteId, WINDOW_DAYS, 0)
  const byQuery = new Map<string, Map<string, Agg>>()
  for (const row of rows) {
    const pages = byQuery.get(row.query) ?? new Map<string, Agg>()
    pages.set(row.page, add(pages.get(row.page), row))
    byQuery.set(row.query, pages)
  }
  const out: Cannibalisation[] = []
  for (const [query, pages] of byQuery) {
    if (pages.size < 2) continue
    const total = [...pages.values()].reduce((sum, a) => sum + a.impressions, 0)
    if (total < minImpressions) continue
    const entries = [...pages.entries()]
      .map(([url, agg]) => ({
        url,
        clicks: agg.clicks,
        impressions: agg.impressions,
        share: agg.impressions / total,
        position: avgPosition(agg),
      }))
      .sort((a, b) => b.share - a.share)
    if (entries[0].share > dominantShare) continue
    const competing = entries.filter((e) => e.share >= minShare)
    if (competing.length < 2) continue
    out.push({ query, impressions: total, pages: competing })
  }
  return out.sort((a, b) => b.impressions - a.impressions)
}

/** Queries that get impressions but where no single page holds them — or
 *  rather, per query the number of pages. Used by the coverage matrix. */
export async function pagesPerQuery(siteId: string): Promise<Map<string, string[]>> {
  const supabase = createClient()
  const rows = await readWindow(supabase, siteId, WINDOW_DAYS, 0)
  const out = new Map<string, Set<string>>()
  for (const row of rows) {
    if (row.impressions === 0) continue
    const set = out.get(row.query) ?? new Set<string>()
    set.add(row.page)
    out.set(row.query, set)
  }
  return new Map([...out.entries()].map(([q, s]) => [q, [...s]]))
}

/** Top pages by impressions — for Core Web Vitals sampling (C1). */
export async function topPagesByImpressions(siteId: string, limit = 10): Promise<string[]> {
  const pages = await sitePages(siteId)
  return [...pages].sort((a, b) => b.impressions - a.impressions).slice(0, limit).map((p) => p.url)
}

/** Whether this site has any query×page history yet. */
export async function hasQueryPageHistory(siteId: string): Promise<boolean> {
  const supabase = createClient()
  const { count } = await supabase
    .from('seo_gsc_query_page')
    .select('site_id', { count: 'exact', head: true })
    .eq('site_id', siteId)
  return (count ?? 0) > 0
}
