import { createClient } from '@/lib/supabase/service'
import { estimatedMonthlyClicks } from '@/lib/growth/ctr'
import type { AdsAccount, AdsCreative, AdsKeyword, AdsSearchTerm } from '@/lib/types'

/**
 * E2: the loops that make paid worth having inside Growth. Every function is
 * a read over ads_* joined to the organic tables; task generation and the
 * paid UI both call these so the numbers agree everywhere.
 *
 * Attribution honesty: Google and Meta conversion figures use different
 * models and windows and WILL double count. Nothing here sums them into one
 * ROAS. `channelTable` keeps them as separate rows.
 */

type Supabase = ReturnType<typeof createClient>

export async function adsAccountsForSite(siteId: string, supabase: Supabase = createClient()): Promise<AdsAccount[]> {
  const { data } = await supabase.from('ads_accounts').select('*').eq('site_id', siteId).eq('status', 'active')
  return (data ?? []) as AdsAccount[]
}

async function googleAccountIds(siteId: string, supabase: Supabase): Promise<string[]> {
  return (await adsAccountsForSite(siteId, supabase)).filter((a) => a.platform === 'google').map((a) => a.id)
}

async function metaAccountIds(siteId: string, supabase: Supabase): Promise<string[]> {
  return (await adsAccountsForSite(siteId, supabase)).filter((a) => a.platform === 'meta').map((a) => a.id)
}

// ── E2.1: search term mining ─────────────────────────────────────────────────

export interface MinedSearchTerm {
  search_term: string
  conversions: number
  conversion_value: number
  cost: number
  clicks: number
  matched_keyword: string | null
  /** Already an organic page for it? */
  has_organic_page: boolean
  in_keyword_list: boolean
}

/** Converting search terms with no organic page and no cluster — proven
 *  commercial demand with no organic asset. */
export async function minedSearchTerms(siteId: string, supabase: Supabase = createClient()): Promise<MinedSearchTerm[]> {
  const accounts = await googleAccountIds(siteId, supabase)
  if (accounts.length === 0) return []
  const { data: terms } = await supabase
    .from('ads_search_terms')
    .select('*')
    .in('account_id', accounts)
    .gt('conversions', 0)
    .order('conversion_value', { ascending: false })
    .limit(500)
  const rows = (terms ?? []) as AdsSearchTerm[]
  if (rows.length === 0) return []

  const termTexts = [...new Set(rows.map((t) => t.search_term))]
  const { data: organic } = await supabase
    .from('seo_gsc_query_page')
    .select('query')
    .eq('site_id', siteId)
    .in('query', termTexts)
    .gt('impressions', 0)
    .limit(5000)
  const hasPage = new Set((organic ?? []).map((r) => r.query as string))
  const { data: known } = await supabase.from('seo_keywords').select('keyword, cluster_id').eq('site_id', siteId).in('keyword', termTexts)
  const knownMap = new Map((known ?? []).map((k) => [k.keyword as string, k.cluster_id as string | null]))

  const agg = new Map<string, MinedSearchTerm>()
  for (const t of rows) {
    const entry = agg.get(t.search_term) ?? {
      search_term: t.search_term,
      conversions: 0,
      conversion_value: 0,
      cost: 0,
      clicks: 0,
      matched_keyword: t.matched_keyword,
      has_organic_page: hasPage.has(t.search_term),
      in_keyword_list: knownMap.has(t.search_term),
    }
    entry.conversions += Number(t.conversions)
    entry.conversion_value += Number(t.conversion_value)
    entry.cost += Number(t.cost)
    entry.clicks += Number(t.clicks)
    agg.set(t.search_term, entry)
  }
  return [...agg.values()]
    .filter((t) => !t.has_organic_page && !knownMap.get(t.search_term))
    .sort((a, b) => b.conversion_value - a.conversion_value || b.conversions - a.conversions)
}

/** Push mined terms into seo_keywords with source 'google_ads' and commercial value. */
export async function pushMinedTermsToKeywords(siteId: string, supabase: Supabase = createClient()): Promise<number> {
  const mined = await minedSearchTerms(siteId, supabase)
  const fresh = mined.filter((t) => !t.in_keyword_list)
  if (fresh.length === 0) return 0
  const now = new Date().toISOString()
  const { error } = await supabase.from('seo_keywords').insert(
    fresh.map((t) => ({
      site_id: siteId,
      keyword: t.search_term,
      source: 'google_ads',
      commercial_value: Math.round(t.conversion_value * 100) / 100,
      value_per_click: t.clicks > 0 ? Math.round((t.conversion_value / t.clicks) * 100) / 100 : null,
      paid_checked_at: now,
      last_refreshed_at: now,
    }))
  )
  if (error) throw new Error(error.message)
  return fresh.length
}

// ── E2.2: paying for what you already own ────────────────────────────────────

export interface OwnedButBought {
  keyword: string
  organic_position: number
  cost: number
  clicks: number
  conversions: number
  average_cpc: number | null
  match_type: string | null
}

export async function paidOnOwnedKeywords(siteId: string, supabase: Supabase = createClient()): Promise<OwnedButBought[]> {
  const accounts = await googleAccountIds(siteId, supabase)
  if (accounts.length === 0) return []
  const { data: owned } = await supabase
    .from('seo_keywords')
    .select('keyword, gsc_position')
    .eq('site_id', siteId)
    .not('gsc_position', 'is', null)
    .lte('gsc_position', 3)
  const ownedMap = new Map((owned ?? []).map((k) => [k.keyword as string, Number(k.gsc_position)]))
  if (ownedMap.size === 0) return []
  const { data: paid } = await supabase
    .from('ads_keywords')
    .select('*')
    .in('account_id', accounts)
    .in('keyword', [...ownedMap.keys()])
    .gt('cost', 0)
  return ((paid ?? []) as AdsKeyword[])
    .map((k) => ({
      keyword: k.keyword,
      organic_position: ownedMap.get(k.keyword) as number,
      cost: Number(k.cost),
      clicks: Number(k.clicks),
      conversions: Number(k.conversions),
      average_cpc: k.average_cpc,
      match_type: k.match_type,
    }))
    .sort((a, b) => b.cost - a.cost)
}

// ── E2.3: the handoff model ──────────────────────────────────────────────────

export interface HandoffOpportunity {
  keyword: string
  organic_position: number
  gsc_impressions: number
  paid_cost: number
  paid_clicks: number
  paid_conversions: number
  cpa: number | null
  average_cpc: number | null
  /** Modelled organic clicks/month at position 3 (CTR curve). */
  organic_clicks_at_3: number
  /** Paid spend/month that becomes optional if organic reaches 3 (= modelled organic clicks × CPC, capped at current spend). */
  optional_spend_per_month: number
  /** Months to pay back `contentCost` at that saving. */
  payback_months: number | null
}

export async function handoffOpportunities(
  siteId: string,
  contentCost = 600,
  supabase: Supabase = createClient()
): Promise<HandoffOpportunity[]> {
  const accounts = await googleAccountIds(siteId, supabase)
  if (accounts.length === 0) return []
  const { data: organic } = await supabase
    .from('seo_keywords')
    .select('keyword, gsc_position, gsc_impressions')
    .eq('site_id', siteId)
    .gte('gsc_position', 4)
    .lte('gsc_position', 20)
  const organicMap = new Map((organic ?? []).map((k) => [k.keyword as string, { position: Number(k.gsc_position), impressions: Number(k.gsc_impressions ?? 0) }]))
  if (organicMap.size === 0) return []
  const { data: paid } = await supabase
    .from('ads_keywords')
    .select('*')
    .in('account_id', accounts)
    .in('keyword', [...organicMap.keys()])
    .gt('conversions', 0)

  const out: HandoffOpportunity[] = []
  for (const k of (paid ?? []) as AdsKeyword[]) {
    const org = organicMap.get(k.keyword)
    if (!org) continue
    const windowDays = k.window_start && k.window_end ? Math.max(1, (Date.parse(k.window_end) - Date.parse(k.window_start)) / 86400_000) : 60
    const monthlySpend = (Number(k.cost) / windowDays) * 30
    const organicAt3 = estimatedMonthlyClicks(org.impressions, 3, 90)
    const cpc = k.average_cpc ?? (Number(k.clicks) > 0 ? Number(k.cost) / Number(k.clicks) : null)
    const optional = Math.min(monthlySpend, cpc ? organicAt3 * cpc : 0)
    out.push({
      keyword: k.keyword,
      organic_position: org.position,
      gsc_impressions: org.impressions,
      paid_cost: Number(k.cost),
      paid_clicks: Number(k.clicks),
      paid_conversions: Number(k.conversions),
      cpa: Number(k.conversions) > 0 ? Math.round((Number(k.cost) / Number(k.conversions)) * 100) / 100 : null,
      average_cpc: cpc,
      organic_clicks_at_3: organicAt3,
      optional_spend_per_month: Math.round(optional),
      payback_months: optional > 0 ? Math.round((contentCost / optional) * 10) / 10 : null,
    })
  }
  return out.sort((a, b) => b.optional_spend_per_month - a.optional_spend_per_month)
}

// ── E2.4: cover the gap while it closes ──────────────────────────────────────

export interface CoverGapKeyword {
  keyword: string
  organic_position: number
  gsc_impressions: number
  intent: string | null
  cpc: number | null
}

export async function coverGapKeywords(siteId: string, supabase: Supabase = createClient()): Promise<CoverGapKeyword[]> {
  const accounts = await googleAccountIds(siteId, supabase)
  if (accounts.length === 0) return []
  const { data: quick } = await supabase
    .from('seo_keywords')
    .select('keyword, gsc_position, gsc_impressions, intent, cpc')
    .eq('site_id', siteId)
    .gte('gsc_position', 11)
    .lte('gsc_position', 20)
    .in('intent', ['commercial', 'transactional'])
    .order('gsc_impressions', { ascending: false, nullsFirst: false })
    .limit(50)
  const rows = quick ?? []
  if (rows.length === 0) return []
  const { data: covered } = await supabase
    .from('ads_keywords')
    .select('keyword')
    .in('account_id', accounts)
    .in('keyword', rows.map((r) => r.keyword as string))
  const coveredSet = new Set((covered ?? []).map((c) => c.keyword as string))
  return rows
    .filter((r) => !coveredSet.has(r.keyword as string))
    .map((r) => ({
      keyword: r.keyword as string,
      organic_position: Number(r.gsc_position),
      gsc_impressions: Number(r.gsc_impressions ?? 0),
      intent: r.intent as string | null,
      cpc: r.cpc as number | null,
    }))
}

// ── E2.5: commercial weighting onto the keyword list ─────────────────────────

/** Carry conversion data from ads_keywords + ads_search_terms onto seo_keywords. */
export async function applyCommercialWeighting(siteId: string, supabase: Supabase = createClient()): Promise<number> {
  const accounts = await googleAccountIds(siteId, supabase)
  if (accounts.length === 0) return 0
  const [{ data: kws }, { data: terms }] = await Promise.all([
    supabase.from('ads_keywords').select('keyword, impressions, clicks, conversions, conversion_value').in('account_id', accounts),
    supabase.from('ads_search_terms').select('search_term, impressions, clicks, conversions, conversion_value').in('account_id', accounts),
  ])
  const agg = new Map<string, { impressions: number; clicks: number; conversions: number; value: number }>()
  const fold = (key: string, r: { impressions: number; clicks: number; conversions: number; conversion_value: number }) => {
    const e = agg.get(key) ?? { impressions: 0, clicks: 0, conversions: 0, value: 0 }
    e.impressions += Number(r.impressions)
    e.clicks += Number(r.clicks)
    e.conversions += Number(r.conversions)
    e.value += Number(r.conversion_value)
    agg.set(key, e)
  }
  for (const k of kws ?? []) fold(k.keyword as string, k as never)
  for (const t of terms ?? []) fold(t.search_term as string, t as never)
  if (agg.size === 0) return 0

  const { data: ours } = await supabase.from('seo_keywords').select('id, keyword').eq('site_id', siteId).in('keyword', [...agg.keys()])
  const now = new Date().toISOString()
  let updated = 0
  for (const k of ours ?? []) {
    const e = agg.get(k.keyword as string)
    if (!e) continue
    await supabase
      .from('seo_keywords')
      .update({
        commercial_value: Math.round(e.value * 100) / 100,
        conversions_per_1000_impressions: e.impressions > 0 ? Math.round((e.conversions / e.impressions) * 1000 * 100) / 100 : null,
        value_per_click: e.clicks > 0 ? Math.round((e.value / e.clicks) * 100) / 100 : null,
        paid_checked_at: now,
      })
      .eq('id', k.id)
    updated += 1
  }
  return updated
}

// ── E2.7: wasted spend ───────────────────────────────────────────────────────

export interface WastedTerm {
  search_term: string
  cost: number
  clicks: number
  matched_keyword: string | null
}

export async function wastedSearchTerms(siteId: string, minSpend = 20, supabase: Supabase = createClient()): Promise<WastedTerm[]> {
  const accounts = await googleAccountIds(siteId, supabase)
  if (accounts.length === 0) return []
  const { data } = await supabase
    .from('ads_search_terms')
    .select('search_term, cost, clicks, matched_keyword, conversions')
    .in('account_id', accounts)
    .eq('conversions', 0)
    .gte('cost', minSpend)
    .order('cost', { ascending: false })
    .limit(100)
  return ((data ?? []) as Array<{ search_term: string; cost: number; clicks: number; matched_keyword: string | null }>).map((r) => ({
    search_term: r.search_term,
    cost: Number(r.cost),
    clicks: Number(r.clicks),
    matched_keyword: r.matched_keyword,
  }))
}

/** Group wasted terms by their most frequent significant word — a pattern list for negatives. */
export function groupWastedTerms(terms: WastedTerm[]): Array<{ pattern: string; cost: number; terms: string[] }> {
  const stop = new Set(['the', 'and', 'for', 'with', 'near', 'how', 'what', 'best', 'a', 'to', 'of', 'in', 'on', 'is'])
  const groups = new Map<string, { cost: number; terms: Set<string> }>()
  for (const t of terms) {
    const words = t.search_term.split(/\s+/).filter((w) => w.length > 2 && !stop.has(w))
    const key = words[0] ?? t.search_term
    const g = groups.get(key) ?? { cost: 0, terms: new Set<string>() }
    g.cost += t.cost
    g.terms.add(t.search_term)
    groups.set(key, g)
  }
  return [...groups.entries()]
    .map(([pattern, g]) => ({ pattern, cost: Math.round(g.cost * 100) / 100, terms: [...g.terms] }))
    .sort((a, b) => b.cost - a.cost)
}

// ── E3.1: winning angles → content angles ────────────────────────────────────

export async function winningAngles(siteId: string, supabase: Supabase = createClient()): Promise<Array<{ headline: string | null; primary_text: string | null; ctr: number }>> {
  const accounts = await metaAccountIds(siteId, supabase)
  if (accounts.length === 0) return []
  const { data } = await supabase
    .from('ads_creatives')
    .select('headline, primary_text, ctr, impressions')
    .in('account_id', accounts)
    .gte('impressions', 1000)
    .not('ctr', 'is', null)
    .order('ctr', { ascending: false })
  const rows = (data ?? []) as Array<{ headline: string | null; primary_text: string | null; ctr: number }>
  const topDecile = Math.max(1, Math.ceil(rows.length / 10))
  return rows.slice(0, topDecile).filter((r) => r.headline || r.primary_text).map((r) => ({ headline: r.headline, primary_text: r.primary_text?.slice(0, 300) ?? null, ctr: r.ctr }))
}

// ── E3.3: creative fatigue ───────────────────────────────────────────────────

export interface FatiguedCreative {
  creative: AdsCreative
  ctrDropPct: number
  replacement: AdsCreative | null
}

export async function fatiguedCreatives(siteId: string, supabase: Supabase = createClient()): Promise<FatiguedCreative[]> {
  const accounts = await metaAccountIds(siteId, supabase)
  if (accounts.length === 0) return []
  const { data } = await supabase.from('ads_creatives').select('*').in('account_id', accounts).eq('status', 'ACTIVE')
  const rows = (data ?? []) as AdsCreative[]
  const best = [...rows].filter((r) => r.ctr !== null && r.impressions >= 1000).sort((a, b) => (b.ctr ?? 0) - (a.ctr ?? 0))[0] ?? null
  return rows
    .filter((r) => r.frequency !== null && r.frequency > 3 && r.first_week_ctr && r.ctr !== null && r.first_week_ctr > 0)
    .map((r) => ({ creative: r, ctrDropPct: Math.round((1 - (r.ctr as number) / (r.first_week_ctr as number)) * 100), replacement: best && best.external_id !== r.external_id ? best : null }))
    .filter((f) => f.ctrDropPct >= 30)
    .sort((a, b) => b.ctrDropPct - a.ctrDropPct)
}

// ── E5: pacing and tracking health ───────────────────────────────────────────

export interface PacingStatus {
  platform: 'google' | 'meta'
  spendMtd: number
  target: number | null
  projectedMonthEnd: number
  variancePct: number | null
}

export async function pacing(siteId: string, monthlyBudget: number | null, supabase: Supabase = createClient()): Promise<PacingStatus[]> {
  const accounts = await adsAccountsForSite(siteId, supabase)
  if (accounts.length === 0) return []
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
  const dayOfMonth = now.getUTCDate()
  const out: PacingStatus[] = []
  for (const platform of ['google', 'meta'] as const) {
    const ids = accounts.filter((a) => a.platform === platform).map((a) => a.id)
    if (ids.length === 0) continue
    const { data } = await supabase.from('ads_daily').select('cost').in('account_id', ids).gte('date', monthStart)
    const spend = (data ?? []).reduce((s, r) => s + Number(r.cost), 0)
    const projected = dayOfMonth > 0 ? (spend / Math.max(1, dayOfMonth - 1)) * daysInMonth : 0
    out.push({
      platform,
      spendMtd: Math.round(spend * 100) / 100,
      target: monthlyBudget,
      projectedMonthEnd: Math.round(projected),
      variancePct: monthlyBudget ? Math.round(((projected - monthlyBudget) / monthlyBudget) * 100) : null,
    })
  }
  return out
}

export interface TrackingHealthIssue {
  campaign: string
  platform: 'google' | 'meta'
  spend14d: number
}

/** Meaningful spend with zero conversions for 14 days is almost always a broken tag. */
export async function trackingHealth(siteId: string, minSpend = 50, supabase: Supabase = createClient()): Promise<TrackingHealthIssue[]> {
  const accounts = await adsAccountsForSite(siteId, supabase)
  if (accounts.length === 0) return []
  const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10)
  const { data } = await supabase
    .from('ads_daily')
    .select('account_id, campaign_id, cost, conversions, ads_campaigns:campaign_id(name)')
    .in('account_id', accounts.map((a) => a.id))
    .gte('date', since)
  const byCampaign = new Map<string, { name: string; platform: 'google' | 'meta'; cost: number; conversions: number }>()
  const platformOf = new Map(accounts.map((a) => [a.id, a.platform]))
  for (const r of data ?? []) {
    const key = (r.campaign_id as string | null) ?? 'account'
    const name = (r.ads_campaigns as unknown as { name: string } | null)?.name ?? 'Account'
    const e = byCampaign.get(key) ?? { name, platform: platformOf.get(r.account_id as string) ?? 'google', cost: 0, conversions: 0 }
    e.cost += Number(r.cost)
    e.conversions += Number(r.conversions)
    byCampaign.set(key, e)
  }
  return [...byCampaign.values()]
    .filter((c) => c.cost >= minSpend && c.conversions === 0)
    .map((c) => ({ campaign: c.name, platform: c.platform, spend14d: Math.round(c.cost * 100) / 100 }))
}

// ── E4: blended reporting inputs ─────────────────────────────────────────────

export interface ChannelRow {
  channel: 'Organic search' | 'Google Ads' | 'Meta Ads'
  clicks: number
  impressions: number
  spend: number | null
  conversions: number | null
  cpa: number | null
}

export async function channelTable(
  siteId: string,
  start: string,
  end: string,
  supabase: Supabase = createClient()
): Promise<{ rows: ChannelRow[]; equivalentMediaValue: number | null; blendedCac: number | null }> {
  const accounts = await adsAccountsForSite(siteId, supabase)
  const rows: ChannelRow[] = []

  const { data: organic } = await supabase.from('seo_gsc_daily').select('clicks, impressions').eq('site_id', siteId).gte('date', start).lt('date', end)
  const orgClicks = (organic ?? []).reduce((s, r) => s + Number(r.clicks), 0)
  const orgImpr = (organic ?? []).reduce((s, r) => s + Number(r.impressions), 0)
  rows.push({ channel: 'Organic search', clicks: orgClicks, impressions: orgImpr, spend: null, conversions: null, cpa: null })

  let totalSpend = 0
  let totalConversions = 0
  for (const platform of ['google', 'meta'] as const) {
    const ids = accounts.filter((a) => a.platform === platform).map((a) => a.id)
    if (ids.length === 0) continue
    const { data } = await supabase.from('ads_daily').select('clicks, impressions, cost, conversions').in('account_id', ids).gte('date', start).lt('date', end)
    const clicks = (data ?? []).reduce((s, r) => s + Number(r.clicks), 0)
    const impressions = (data ?? []).reduce((s, r) => s + Number(r.impressions), 0)
    const spend = (data ?? []).reduce((s, r) => s + Number(r.cost), 0)
    const conversions = (data ?? []).reduce((s, r) => s + Number(r.conversions), 0)
    totalSpend += spend
    totalConversions += conversions
    rows.push({
      channel: platform === 'google' ? 'Google Ads' : 'Meta Ads',
      clicks,
      impressions,
      spend: Math.round(spend * 100) / 100,
      conversions: Math.round(conversions * 100) / 100,
      cpa: conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : null,
    })
  }

  // Equivalent media value: organic clicks per query × that query's CPC
  // (Ads first, DataForSEO CPC estimate as fallback). A model, labelled as such.
  let emv: number | null = null
  const googleIds = accounts.filter((a) => a.platform === 'google').map((a) => a.id)
  const { data: qp } = await supabase
    .from('seo_gsc_query_page')
    .select('query, clicks')
    .eq('site_id', siteId)
    .gte('date', start)
    .lt('date', end)
    .gt('clicks', 0)
    .limit(20000)
  if (qp && qp.length > 0) {
    const clicksByQuery = new Map<string, number>()
    for (const r of qp) clicksByQuery.set(r.query as string, (clicksByQuery.get(r.query as string) ?? 0) + Number(r.clicks))
    const queries = [...clicksByQuery.keys()]
    const cpcByQuery = new Map<string, number>()
    if (googleIds.length > 0) {
      const { data: paid } = await supabase.from('ads_keywords').select('keyword, average_cpc').in('account_id', googleIds).in('keyword', queries.slice(0, 5000))
      for (const p of paid ?? []) if (p.average_cpc) cpcByQuery.set(p.keyword as string, Number(p.average_cpc))
    }
    const { data: est } = await supabase.from('seo_keywords').select('keyword, cpc').eq('site_id', siteId).in('keyword', queries.slice(0, 5000)).not('cpc', 'is', null)
    for (const e of est ?? []) if (!cpcByQuery.has(e.keyword as string)) cpcByQuery.set(e.keyword as string, Number(e.cpc))
    let total = 0
    let covered = false
    for (const [query, clicks] of clicksByQuery) {
      const cpc = cpcByQuery.get(query)
      if (cpc) {
        total += clicks * cpc
        covered = true
      }
    }
    emv = covered ? Math.round(total) : null
  }

  const blendedCac = totalConversions > 0 ? Math.round((totalSpend / totalConversions) * 100) / 100 : null
  return { rows, equivalentMediaValue: emv, blendedCac }
}

/** Spend, organic clicks and blended CAC over the trailing N months (for the report trend). */
export async function trailingTrend(siteId: string, months = 6, supabase: Supabase = createClient()): Promise<Array<{ month: string; spend: number; organicClicks: number; blendedCac: number | null }>> {
  const out: Array<{ month: string; spend: number; organicClicks: number; blendedCac: number | null }> = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1))
    const { rows, blendedCac } = await channelTable(siteId, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10), supabase)
    out.push({
      month: start.toISOString().slice(0, 7),
      spend: rows.reduce((s, r) => s + (r.spend ?? 0), 0),
      organicClicks: rows.find((r) => r.channel === 'Organic search')?.clicks ?? 0,
      blendedCac,
    })
  }
  return out
}
