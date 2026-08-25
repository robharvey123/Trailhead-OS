import { createClient } from '@/lib/supabase/service'
import {
  ADS_SCOPE,
  getAllGoogleTokens,
  getAuthenticatedClientForToken,
  markTokenNeedsReconnect,
  tokenHasScope,
} from '@/lib/google/oauth'
import type { AdsAccount } from '@/lib/types'

/**
 * E1: Google Ads → ads_* tables. GAQL through the REST searchStream endpoint,
 * nightly (ads-sync cron, 05:15) so paid signal is on the keyword list before
 * the morning's enrichment and task runs.
 *
 * Access: a developer token issued against the MCC (GOOGLE_ADS_DEVELOPER_TOKEN)
 * plus the existing Google OAuth grant carrying the adwords scope. When the
 * grant lacks the scope we flag needs_reconnect exactly as GSC does — one
 * reconnect pattern, not two. GOOGLE_ADS_LOGIN_CUSTOMER_ID is the MCC id used
 * as login-customer-id when reading client accounts through the manager.
 *
 * The API version moves quarterly; pin it with GOOGLE_ADS_API_VERSION and
 * verify against https://developers.google.com/google-ads/api/docs/release-notes
 * before the first live sync.
 */

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION ?? 'v21'
const WINDOW_DAYS = 60
const DAILY_DAYS = 120

type Supabase = ReturnType<typeof createClient>

export function googleAdsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN)
}

async function adsAccessToken(): Promise<string> {
  const tokens = await getAllGoogleTokens()
  if (tokens.length === 0) throw new Error('No Google account connected')
  const withScope = [...tokens].reverse().find((row) => tokenHasScope(row, ADS_SCOPE))
  if (!withScope) {
    const newest = tokens[tokens.length - 1]
    await markTokenNeedsReconnect(newest.id, `missing_scope:${ADS_SCOPE}`)
    throw new Error('The connected Google account has not granted Google Ads access — reconnect Google to grant the new scope')
  }
  const client = await getAuthenticatedClientForToken(withScope)
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('Could not obtain a Google access token')
  return token
}

interface GaqlRow {
  [key: string]: unknown
}

/** Run a GAQL query via searchStream, flattening the streamed chunks. */
export async function gaql(customerId: string, query: string): Promise<GaqlRow[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!developerToken) throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN is not configured')
  const token = await adsAccessToken()
  const cid = customerId.replace(/-/g, '')
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  }
  const loginCustomer = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, '')
  if (loginCustomer) headers['login-customer-id'] = loginCustomer

  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers/${cid}/googleAds:searchStream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Google Ads searchStream failed (${res.status}): ${body.slice(0, 400)}`)
  }
  const chunks = (await res.json()) as Array<{ results?: GaqlRow[] }>
  return chunks.flatMap((c) => c.results ?? [])
}

function get<T>(row: GaqlRow, path: string): T | undefined {
  return path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), row) as T | undefined
}

function micros(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 0
  return Math.round((n / 1_000_000) * 100) / 100
}

function num(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 0
  return Number.isFinite(n) ? n : 0
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Accounts visible to the connected grant — for the "link an account" UI. */
export async function listAccessibleCustomers(): Promise<Array<{ id: string; name: string | null; currency: string | null }>> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!developerToken) throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN is not configured')
  const token = await adsAccessToken()
  const res = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`, {
    headers: { Authorization: `Bearer ${token}`, 'developer-token': developerToken },
  })
  if (!res.ok) throw new Error(`listAccessibleCustomers failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
  const json = (await res.json()) as { resourceNames?: string[] }
  const ids = (json.resourceNames ?? []).map((r) => r.replace('customers/', ''))
  const out: Array<{ id: string; name: string | null; currency: string | null }> = []
  for (const id of ids) {
    try {
      const rows = await gaql(id, 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager FROM customer')
      const row = rows[0]
      if (get<boolean>(row, 'customer.manager')) {
        // Expand the manager's client accounts.
        const clients = await gaql(
          id,
          'SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager FROM customer_client WHERE customer_client.level <= 1'
        )
        for (const c of clients) {
          if (get<boolean>(c, 'customerClient.manager')) continue
          out.push({
            id: String(get(c, 'customerClient.id') ?? ''),
            name: get<string>(c, 'customerClient.descriptiveName') ?? null,
            currency: get<string>(c, 'customerClient.currencyCode') ?? null,
          })
        }
      } else {
        out.push({ id, name: get<string>(row, 'customer.descriptiveName') ?? null, currency: get<string>(row, 'customer.currencyCode') ?? null })
      }
    } catch {
      out.push({ id, name: null, currency: null })
    }
  }
  return out
}

export interface GoogleSyncResult {
  account: string
  campaigns: number
  daily: number
  keywords: number
  searchTerms: number
}

export async function syncGoogleAccount(account: AdsAccount): Promise<GoogleSyncResult> {
  const supabase = createClient()
  const cid = account.external_id
  const windowStart = isoDaysAgo(WINDOW_DAYS)
  const windowEnd = isoDaysAgo(1)

  // ── Structure ──
  const campaignRows = await gaql(
    cid,
    `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.bidding_strategy_type, campaign_budget.amount_micros FROM campaign WHERE campaign.status != 'REMOVED'`
  )
  const campaignIdMap = new Map<string, string>()
  for (const row of campaignRows) {
    const externalId = String(get(row, 'campaign.id') ?? '')
    if (!externalId) continue
    const { data } = await supabase
      .from('ads_campaigns')
      .upsert(
        {
          account_id: account.id,
          external_id: externalId,
          name: get<string>(row, 'campaign.name') ?? externalId,
          channel: (get<string>(row, 'campaign.advertisingChannelType') ?? '').toLowerCase() || null,
          status: get<string>(row, 'campaign.status') ?? null,
          daily_budget: micros(get(row, 'campaignBudget.amountMicros')),
          bidding_strategy: get<string>(row, 'campaign.biddingStrategyType') ?? null,
        },
        { onConflict: 'account_id,external_id' }
      )
      .select('id')
      .single()
    if (data) campaignIdMap.set(externalId, data.id as string)
  }

  // ── Daily time series, campaign level ──
  const dailyRows = await gaql(
    cid,
    `SELECT campaign.id, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${isoDaysAgo(DAILY_DAYS)}' AND '${windowEnd}'`
  )
  const daily = dailyRows
    .map((row) => ({
      account_id: account.id,
      campaign_id: campaignIdMap.get(String(get(row, 'campaign.id') ?? '')) ?? null,
      date: get<string>(row, 'segments.date') as string,
      impressions: num(get(row, 'metrics.impressions')),
      clicks: num(get(row, 'metrics.clicks')),
      cost: micros(get(row, 'metrics.costMicros')),
      conversions: num(get(row, 'metrics.conversions')),
      conversion_value: num(get(row, 'metrics.conversionsValue')),
    }))
    .filter((r) => r.date && r.campaign_id)
  for (let i = 0; i < daily.length; i += 500) {
    const { error } = await supabase.from('ads_daily').upsert(daily.slice(i, i + 500), { onConflict: 'account_id,campaign_key,date' })
    if (error) throw new Error(error.message)
  }

  // ── Keyword performance with Quality Score and impression share ──
  const keywordRows = await gaql(
    cid,
    `SELECT campaign.id, ad_group.id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, ad_group_criterion.quality_info.quality_score, ad_group_criterion.quality_info.post_click_quality_score, ad_group_criterion.quality_info.creative_quality_score, ad_group_criterion.quality_info.search_predicted_ctr, ad_group_criterion.final_urls, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.average_cpc, metrics.search_impression_share, metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share FROM keyword_view WHERE segments.date BETWEEN '${windowStart}' AND '${windowEnd}' AND ad_group_criterion.status != 'REMOVED'`
  )
  const keywords = keywordRows
    .map((row) => ({
      account_id: account.id,
      campaign_id: campaignIdMap.get(String(get(row, 'campaign.id') ?? '')) ?? null,
      ad_group_external_id: String(get(row, 'adGroup.id') ?? '') || null,
      keyword: (get<string>(row, 'adGroupCriterion.keyword.text') ?? '').toLowerCase(),
      match_type: get<string>(row, 'adGroupCriterion.keyword.matchType') ?? null,
      status: get<string>(row, 'adGroupCriterion.status') ?? null,
      quality_score: get<number>(row, 'adGroupCriterion.qualityInfo.qualityScore') ?? null,
      qs_landing_page: get<string>(row, 'adGroupCriterion.qualityInfo.postClickQualityScore') ?? null,
      qs_ad_relevance: get<string>(row, 'adGroupCriterion.qualityInfo.creativeQualityScore') ?? null,
      qs_expected_ctr: get<string>(row, 'adGroupCriterion.qualityInfo.searchPredictedCtr') ?? null,
      landing_page: get<string[]>(row, 'adGroupCriterion.finalUrls')?.[0] ?? null,
      impressions: num(get(row, 'metrics.impressions')),
      clicks: num(get(row, 'metrics.clicks')),
      cost: micros(get(row, 'metrics.costMicros')),
      conversions: num(get(row, 'metrics.conversions')),
      conversion_value: num(get(row, 'metrics.conversionsValue')),
      average_cpc: micros(get(row, 'metrics.averageCpc')),
      impression_share: get<number>(row, 'metrics.searchImpressionShare') ?? null,
      lost_is_budget: get<number>(row, 'metrics.searchBudgetLostImpressionShare') ?? null,
      lost_is_rank: get<number>(row, 'metrics.searchRankLostImpressionShare') ?? null,
      window_start: windowStart,
      window_end: windowEnd,
    }))
    .filter((k) => k.keyword)
  // Rows are per-day-less already (no date segment selected) so one per criterion.
  const seenKw = new Set<string>()
  const dedupedKw = keywords.filter((k) => {
    const key = `${k.campaign_id}|${k.keyword}|${k.match_type}`
    if (seenKw.has(key)) return false
    seenKw.add(key)
    return true
  })
  for (let i = 0; i < dedupedKw.length; i += 500) {
    const { error } = await supabase
      .from('ads_keywords')
      .upsert(dedupedKw.slice(i, i + 500), { onConflict: 'account_id,campaign_key,keyword,match_type' })
    if (error) throw new Error(error.message)
  }

  // ── Search terms report — the prize ──
  const termRows = await gaql(
    cid,
    `SELECT campaign.id, search_term_view.search_term, segments.keyword.info.text, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM search_term_view WHERE segments.date BETWEEN '${windowStart}' AND '${windowEnd}'`
  )
  const termAgg = new Map<string, Record<string, unknown> & { impressions: number; clicks: number; cost: number; conversions: number; conversion_value: number }>()
  for (const row of termRows) {
    const term = (get<string>(row, 'searchTermView.searchTerm') ?? '').toLowerCase()
    if (!term) continue
    const campaignId = campaignIdMap.get(String(get(row, 'campaign.id') ?? '')) ?? null
    const key = `${campaignId}|${term}`
    const entry = termAgg.get(key) ?? {
      account_id: account.id,
      search_term: term,
      matched_keyword: (get<string>(row, 'segments.keyword.info.text') ?? '').toLowerCase() || null,
      campaign_id: campaignId,
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
      conversion_value: 0,
      window_start: windowStart,
      window_end: windowEnd,
    }
    entry.impressions += num(get(row, 'metrics.impressions'))
    entry.clicks += num(get(row, 'metrics.clicks'))
    entry.cost += micros(get(row, 'metrics.costMicros'))
    entry.conversions += num(get(row, 'metrics.conversions'))
    entry.conversion_value += num(get(row, 'metrics.conversionsValue'))
    termAgg.set(key, entry)
  }
  const terms = [...termAgg.values()]
  await supabase.from('ads_search_terms').delete().eq('account_id', account.id)
  for (let i = 0; i < terms.length; i += 500) {
    const { error } = await supabase
      .from('ads_search_terms')
      .upsert(terms.slice(i, i + 500), { onConflict: 'account_id,search_term,campaign_key' })
    if (error) throw new Error(error.message)
  }

  await supabase
    .from('ads_accounts')
    .update({ last_synced_at: new Date().toISOString(), last_error: null })
    .eq('id', account.id)

  return { account: account.external_id, campaigns: campaignIdMap.size, daily: daily.length, keywords: dedupedKw.length, searchTerms: terms.length }
}

export async function syncAllGoogleAccounts(supabase: Supabase = createClient()): Promise<{
  synced: GoogleSyncResult[]
  errors: Array<{ account: string; error: string }>
}> {
  const synced: GoogleSyncResult[] = []
  const errors: Array<{ account: string; error: string }> = []
  if (!googleAdsConfigured()) {
    errors.push({ account: '*', error: 'GOOGLE_ADS_DEVELOPER_TOKEN not configured' })
    return { synced, errors }
  }
  const { data: accounts } = await supabase.from('ads_accounts').select('*').eq('platform', 'google').eq('status', 'active')
  for (const account of (accounts ?? []) as AdsAccount[]) {
    try {
      synced.push(await syncGoogleAccount(account))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ account: account.external_id, error: message })
      await supabase.from('ads_accounts').update({ last_error: message }).eq('id', account.id)
    }
  }
  return { synced, errors }
}
