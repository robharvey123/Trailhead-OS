import { createClient } from '@/lib/supabase/service'
import { dataForSeoConfigured } from '@/lib/growth/dataforseo'
import { LABS_COST, bulkKeywordDifficulty, historicalSearchVolume, searchIntent } from '@/lib/growth/labs'
import type { SeoSite } from '@/lib/types'

/**
 * growth-enrich cron (daily 05:30, after gsc-sync): give every keyword an
 * honest difficulty and a measured intent from DataForSEO Labs, plus monthly
 * volume history for seasonality. Refreshes anything never enriched or older
 * than 30 days, 1000 keywords per call, and respects the per-site API spend
 * guard (seo_sites.monthly_api_budget).
 */

const REFRESH_DAYS = 30
const PER_SITE_CAP = 3000 // keywords per run, keeps the cron well inside maxDuration

type Supabase = ReturnType<typeof createClient>

export interface EnrichResult {
  sites: Array<{ site: string; enriched: number; seasonality: number; skipped?: string }>
  errors: Array<{ site: string; error: string }>
}

// ── Spend guard ──────────────────────────────────────────────────────────────

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

/** Month-to-date DataForSEO spend for a site, resetting on month change. */
export async function apiSpendMtd(supabase: Supabase, site: SeoSite): Promise<number> {
  if (site.api_spend_month === currentMonth()) return Number(site.api_spend_mtd ?? 0)
  await supabase.from('seo_sites').update({ api_spend_month: currentMonth(), api_spend_mtd: 0 }).eq('id', site.id)
  return 0
}

/** True when the site's monthly API budget is exhausted (non-essential work pauses). */
export async function apiBudgetExhausted(supabase: Supabase, site: SeoSite): Promise<boolean> {
  if (site.monthly_api_budget === null || site.monthly_api_budget === undefined) return false
  const spent = await apiSpendMtd(supabase, site)
  return spent >= Number(site.monthly_api_budget)
}

/** Add an estimated USD cost to the site's month-to-date counter. */
export async function recordApiSpend(siteId: string, usd: number): Promise<void> {
  if (usd <= 0) return
  const supabase = createClient()
  const { data: site } = await supabase
    .from('seo_sites')
    .select('api_spend_month, api_spend_mtd')
    .eq('id', siteId)
    .maybeSingle()
  const base = site?.api_spend_month === currentMonth() ? Number(site.api_spend_mtd ?? 0) : 0
  await supabase
    .from('seo_sites')
    .update({ api_spend_month: currentMonth(), api_spend_mtd: Math.round((base + usd) * 10000) / 10000 })
    .eq('id', siteId)
}

// ── A1: KD + intent ──────────────────────────────────────────────────────────

export async function enrichSite(site: SeoSite): Promise<{ enriched: number; seasonality: number }> {
  const supabase = createClient()
  const cutoff = new Date(Date.now() - REFRESH_DAYS * 86400_000).toISOString()

  const { data: rows, error } = await supabase
    .from('seo_keywords')
    .select('id, keyword')
    .eq('site_id', site.id)
    .or(`enriched_at.is.null,enriched_at.lt.${cutoff}`)
    .order('gsc_impressions', { ascending: false, nullsFirst: false })
    .limit(PER_SITE_CAP)
  if (error) throw new Error(error.message)
  const keywords = (rows ?? []) as Array<{ id: string; keyword: string }>
  if (keywords.length === 0) return { enriched: 0, seasonality: 0 }

  const texts = keywords.map((k) => k.keyword)
  const [kd, intent] = await Promise.all([bulkKeywordDifficulty(texts), searchIntent(texts)])
  await recordApiSpend(site.id, texts.length * (LABS_COST.bulk_kd_per_keyword + LABS_COST.intent_per_keyword))

  const now = new Date().toISOString()
  const updates = keywords.map((k) => {
    const difficulty = kd.get(k.keyword) ?? null
    const found = intent.get(k.keyword)
    return {
      id: k.id,
      site_id: site.id,
      keyword: k.keyword,
      keyword_difficulty: difficulty,
      difficulty, // display column — Labs KD only from here on
      ...(found
        ? { intent: found.label, intent_confidence: found.probability, intent_source: 'dataforseo' }
        : {}),
      enriched_at: now,
    }
  })
  for (let i = 0; i < updates.length; i += 500) {
    const { error: upErr } = await supabase.from('seo_keywords').upsert(updates.slice(i, i + 500))
    if (upErr) throw new Error(upErr.message)
  }

  // B3: monthly history for keywords that have none yet (one pull each, ~4 years).
  const { data: withHistory } = await supabase
    .from('seo_keyword_volume_monthly')
    .select('keyword_id')
    .in('keyword_id', keywords.map((k) => k.id))
  const have = new Set((withHistory ?? []).map((r) => r.keyword_id as string))
  const needHistory = keywords.filter((k) => !have.has(k.id)).slice(0, 700)
  let seasonality = 0
  if (needHistory.length > 0) {
    const history = await historicalSearchVolume(needHistory.map((k) => k.keyword))
    await recordApiSpend(site.id, needHistory.length * LABS_COST.historical_per_keyword)
    const rowsToInsert: Array<{ keyword_id: string; year: number; month: number; search_volume: number }> = []
    for (const k of needHistory) {
      const months = history.get(k.keyword)
      if (!months) continue
      for (const m of months) rowsToInsert.push({ keyword_id: k.id, ...m })
      seasonality += 1
    }
    for (let i = 0; i < rowsToInsert.length; i += 500) {
      const { error: histErr } = await supabase
        .from('seo_keyword_volume_monthly')
        .upsert(rowsToInsert.slice(i, i + 500), { onConflict: 'keyword_id,year,month' })
      if (histErr) throw new Error(histErr.message)
    }
  }

  return { enriched: updates.length, seasonality }
}

export async function enrichAllSites(): Promise<EnrichResult> {
  const result: EnrichResult = { sites: [], errors: [] }
  if (!dataForSeoConfigured()) {
    result.errors.push({ site: '*', error: 'DataForSEO not configured' })
    return result
  }
  const supabase = createClient()
  const { data: sites, error } = await supabase.from('seo_sites').select('*')
  if (error) throw new Error(error.message)

  for (const site of (sites ?? []) as SeoSite[]) {
    try {
      if (await apiBudgetExhausted(supabase, site)) {
        result.sites.push({ site: site.domain, enriched: 0, seasonality: 0, skipped: 'monthly API budget reached' })
        continue
      }
      const r = await enrichSite(site)
      result.sites.push({ site: site.domain, ...r })
    } catch (err) {
      result.errors.push({ site: site.domain, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return result
}

// ── B3: seasonality helpers ──────────────────────────────────────────────────

/** Month (1-12) with the highest average volume across the history, or null. */
export function peakMonth(rows: Array<{ month: number; search_volume: number }>): number | null {
  if (rows.length === 0) return null
  const sums = new Map<number, { total: number; n: number }>()
  for (const r of rows) {
    const s = sums.get(r.month) ?? { total: 0, n: 0 }
    s.total += r.search_volume
    s.n += 1
    sums.set(r.month, s)
  }
  let best: [number, number] | null = null
  for (const [month, s] of sums) {
    const avg = s.total / s.n
    if (!best || avg > best[1]) best = [month, avg]
  }
  return best ? best[0] : null
}

/** Weeks from today until the next occurrence of `month` (1-12) begins. */
export function weeksUntilMonth(month: number, now = new Date()): number {
  const year = now.getUTCMonth() + 1 <= month ? now.getUTCFullYear() : now.getUTCFullYear() + 1
  const target = Date.UTC(year, month - 1, 1)
  return Math.round((target - now.getTime()) / (7 * 86400_000))
}
