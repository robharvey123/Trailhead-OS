import { createClient } from '@/lib/supabase/server'
import type {
  SeoAiMention,
  SeoArticle,
  SeoBrief,
  SeoCluster,
  SeoGrowthScore,
  SeoGscDaily,
  SeoKeyword,
  SeoLinkTarget,
  SeoSite,
} from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export interface SeoSiteListItem extends SeoSite {
  keyword_count: number
  account_name: string | null
}

export async function getSeoSites(client?: SupabaseClient): Promise<SeoSiteListItem[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('seo_sites')
    .select('*, accounts:client_account_id(name)')
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  const sites = (data ?? []) as Array<SeoSite & { accounts: { name: string } | null }>
  const counts = await Promise.all(
    sites.map(async (site) => {
      const { count } = await supabase
        .from('seo_keywords')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', site.id)
      return count ?? 0
    })
  )
  return sites.map((site, i) => {
    const { accounts, ...rest } = site
    return { ...rest, keyword_count: counts[i], account_name: accounts?.name ?? null }
  })
}

export async function getSeoSiteById(id: string, client?: SupabaseClient): Promise<SeoSite | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('seo_sites').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as SeoSite | null) ?? null
}

export interface CreateSeoSiteInput {
  name: string
  domain: string
  workstream_id?: string | null
  client_account_id?: string | null
  gsc_property?: string | null
  brand_voice?: string | null
  icp?: string | null
  is_client?: boolean
}

export async function createSeoSite(
  input: CreateSeoSiteInput,
  client?: SupabaseClient
): Promise<SeoSite> {
  const supabase = await getSupabase(client)
  if (input.is_client && !input.client_account_id) {
    // Client SEO work must roll up to the same CRM account as the client's invoices.
    throw new Error('Client sites must be linked to a CRM account')
  }
  const { data, error } = await supabase
    .from('seo_sites')
    .insert({
      name: input.name,
      domain: input.domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
      workstream_id: input.workstream_id ?? null,
      client_account_id: input.client_account_id ?? null,
      gsc_property: input.gsc_property || null,
      brand_voice: input.brand_voice || null,
      icp: input.icp || null,
      is_client: input.is_client ?? false,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as SeoSite
}

export interface UpdateSeoSiteInput {
  name: string
  gsc_property: string | null
  workstream_id: string | null
  client_account_id: string | null
  brand_voice: string | null
  icp: string | null
  is_client: boolean
  cms_type?: 'none' | 'github' | 'wordpress' | 'internal'
  cms_config?: Record<string, unknown>
}

export async function updateSeoSite(
  id: string,
  input: UpdateSeoSiteInput,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  if (!input.name) throw new Error('Name is required')
  if (input.is_client && !input.client_account_id) {
    throw new Error('Client sites must be linked to a CRM account')
  }
  const { error } = await supabase.from('seo_sites').update(input).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getSeoKeywords(
  siteId: string,
  client?: SupabaseClient
): Promise<SeoKeyword[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('seo_keywords')
    .select('*')
    .eq('site_id', siteId)
    .order('gsc_clicks', { ascending: false, nullsFirst: false })
    .order('search_volume', { ascending: false, nullsFirst: false })
    .limit(1000)
  if (error) throw new Error(error.message)
  return (data ?? []) as SeoKeyword[]
}

export interface SeoClusterListItem extends SeoCluster {
  keyword_count: number
}

export async function getSeoClusters(
  siteId: string,
  client?: SupabaseClient
): Promise<SeoClusterListItem[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('seo_clusters')
    .select('*')
    .eq('site_id', siteId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  const clusters = (data ?? []) as SeoCluster[]

  const counts = await Promise.all(
    clusters.map(async (cluster) => {
      const { count } = await supabase
        .from('seo_keywords')
        .select('id', { count: 'exact', head: true })
        .eq('cluster_id', cluster.id)
      return count ?? 0
    })
  )
  return clusters.map((cluster, i) => ({ ...cluster, keyword_count: counts[i] }))
}

export async function getSeoBriefs(siteId: string, client?: SupabaseClient): Promise<SeoBrief[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('seo_briefs')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as SeoBrief[]
}

export async function getSeoBriefById(id: string, client?: SupabaseClient): Promise<SeoBrief | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('seo_briefs').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as SeoBrief | null) ?? null
}

export async function getSeoArticles(siteId: string, client?: SupabaseClient): Promise<SeoArticle[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('seo_articles')
    .select('*')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as SeoArticle[]
}

export async function getSeoArticleById(
  id: string,
  client?: SupabaseClient
): Promise<SeoArticle | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('seo_articles').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as SeoArticle | null) ?? null
}

export interface SeoLinkTargetListItem extends SeoLinkTarget {
  account_name: string | null
}

export async function getSeoLinkTargets(
  siteId: string,
  client?: SupabaseClient
): Promise<SeoLinkTargetListItem[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('seo_link_targets')
    .select('*, accounts:crm_account_id(name)')
    .eq('site_id', siteId)
    .order('tier', { ascending: true })
    .order('domain_authority', { ascending: false, nullsFirst: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<SeoLinkTarget & { accounts: { name: string } | null }>).map(
    ({ accounts, ...rest }) => ({ ...rest, account_name: accounts?.name ?? null })
  )
}

export interface ArticleStub {
  id: string
  title: string
  status: string
  published_url: string | null
}

export interface SiteDashboardData {
  keywords: SeoKeyword[]
  clusters: SeoCluster[]
  briefs: SeoBrief[]
  articles: ArticleStub[]
  daily: SeoGscDaily[]
  scores: SeoGrowthScore[]
  mentions: SeoAiMention[]
  activePromptCount: number
  linkTargetCount: number
}

/** Everything the command centre renders, fetched in one parallel burst —
 *  the page must stay comfortably under the two-second budget. */
export async function getSiteDashboardData(
  siteId: string,
  client?: SupabaseClient
): Promise<SiteDashboardData> {
  const supabase = await getSupabase(client)
  const since28 = new Date(Date.now() - 28 * 86400_000).toISOString()

  const [keywords, clusters, briefs, articles, daily, scores, mentions, promptRes, linkRes] = await Promise.all([
    getSeoKeywords(siteId, supabase),
    supabase
      .from('seo_clusters')
      .select('*')
      .eq('site_id', siteId)
      .order('priority', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        return (data ?? []) as SeoCluster[]
      }),
    supabase
      .from('seo_briefs')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        return (data ?? []) as SeoBrief[]
      }),
    supabase
      .from('seo_articles')
      .select('id, title, status, published_url')
      .eq('site_id', siteId)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        return (data ?? []) as ArticleStub[]
      }),
    supabase
      .from('seo_gsc_daily')
      .select('*')
      .eq('site_id', siteId)
      .order('date', { ascending: true })
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        return (data ?? []) as SeoGscDaily[]
      }),
    supabase
      .from('seo_growth_scores')
      .select('*')
      .eq('site_id', siteId)
      .order('score_date', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        return (data ?? []) as SeoGrowthScore[]
      }),
    supabase
      .from('seo_ai_mentions')
      .select('*')
      .eq('site_id', siteId)
      .gte('run_at', since28)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message)
        return (data ?? []) as SeoAiMention[]
      }),
    supabase
      .from('seo_prompts')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('active', true),
    supabase
      .from('seo_link_targets')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId),
  ])

  return {
    keywords,
    clusters,
    briefs,
    articles,
    daily,
    scores,
    mentions,
    activePromptCount: promptRes.count ?? 0,
    linkTargetCount: linkRes.count ?? 0,
  }
}

// ── v2: research depth, worksheets, competitors, paid ────────────────────────

import type {
  AdsAccount,
  AdsCampaign,
  AdsCreative,
  AdsKeyword,
  AdsSearchTerm,
  SeoCompetitor,
  SeoPageIssue,
  SeoSerpState,
} from '@/lib/types'

/** Latest parsed SERP state per keyword for a site. */
export async function getLatestSerpStates(
  siteId: string,
  client?: SupabaseClient
): Promise<Map<string, SeoSerpState>> {
  const supabase = await getSupabase(client)
  const { data: keywords } = await supabase.from('seo_keywords').select('id').eq('site_id', siteId)
  const ids = (keywords ?? []).map((k) => k.id as string)
  const out = new Map<string, SeoSerpState>()
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await supabase
      .from('seo_serp_state')
      .select('*')
      .in('keyword_id', ids.slice(i, i + 500))
      .order('captured_at', { ascending: false })
    for (const s of (data ?? []) as SeoSerpState[]) if (!out.has(s.keyword_id)) out.set(s.keyword_id, s)
  }
  return out
}

export interface RefreshSummary {
  id: string
  url: string
  status: 'open' | 'applied' | 'dismissed'
  generated_at: string
  estimated_upside_clicks: number | null
  pr_url: string | null
}

export async function getRefreshSummaries(siteId: string, client?: SupabaseClient): Promise<RefreshSummary[]> {
  const supabase = await getSupabase(client)
  const { data } = await supabase
    .from('seo_page_refreshes')
    .select('id, url, status, generated_at, estimated_upside_clicks, pr_url')
    .eq('site_id', siteId)
    .order('generated_at', { ascending: false })
  return (data ?? []) as RefreshSummary[]
}

export async function getSeoCompetitors(siteId: string, client?: SupabaseClient): Promise<SeoCompetitor[]> {
  const supabase = await getSupabase(client)
  const { data } = await supabase.from('seo_competitors').select('*').eq('site_id', siteId).order('created_at')
  return (data ?? []) as SeoCompetitor[]
}

export async function getOpenPageIssues(siteId: string, client?: SupabaseClient): Promise<SeoPageIssue[]> {
  const supabase = await getSupabase(client)
  const { data } = await supabase
    .from('seo_page_issues')
    .select('*')
    .eq('site_id', siteId)
    .is('resolved_at', null)
    .order('severity')
    .order('last_seen_at', { ascending: false })
    .limit(500)
  return (data ?? []) as SeoPageIssue[]
}

export async function getAdsAccounts(siteId: string, client?: SupabaseClient): Promise<AdsAccount[]> {
  const supabase = await getSupabase(client)
  const { data } = await supabase.from('ads_accounts').select('*').eq('site_id', siteId).order('platform')
  return (data ?? []) as AdsAccount[]
}

export interface PaidData {
  accounts: AdsAccount[]
  campaigns: AdsCampaign[]
  keywords: AdsKeyword[]
  searchTerms: AdsSearchTerm[]
  creatives: AdsCreative[]
  daily: Array<{ account_id: string; date: string; cost: number; clicks: number; conversions: number; conversion_value: number; impressions: number }>
}

export async function getPaidData(siteId: string, client?: SupabaseClient): Promise<PaidData> {
  const supabase = await getSupabase(client)
  const accounts = await getAdsAccounts(siteId, supabase)
  const ids = accounts.map((a) => a.id)
  if (ids.length === 0) return { accounts, campaigns: [], keywords: [], searchTerms: [], creatives: [], daily: [] }
  const since = new Date(Date.now() - 120 * 86400_000).toISOString().slice(0, 10)
  const [campaigns, keywords, searchTerms, creatives, daily] = await Promise.all([
    supabase.from('ads_campaigns').select('*').in('account_id', ids).order('name'),
    supabase.from('ads_keywords').select('*').in('account_id', ids).order('cost', { ascending: false }).limit(500),
    supabase.from('ads_search_terms').select('*').in('account_id', ids).order('cost', { ascending: false }).limit(500),
    supabase.from('ads_creatives').select('*').in('account_id', ids).order('spend', { ascending: false }).limit(200),
    supabase.from('ads_daily').select('account_id, date, cost, clicks, conversions, conversion_value, impressions').in('account_id', ids).gte('date', since).order('date'),
  ])
  return {
    accounts,
    campaigns: (campaigns.data ?? []) as AdsCampaign[],
    keywords: (keywords.data ?? []) as AdsKeyword[],
    searchTerms: (searchTerms.data ?? []) as AdsSearchTerm[],
    creatives: (creatives.data ?? []) as AdsCreative[],
    daily: (daily.data ?? []) as PaidData['daily'],
  }
}

/** Month-to-date paid spend across a site's accounts — for the overview tile. */
export async function getPaidTile(
  siteId: string,
  client?: SupabaseClient
): Promise<{ spend: number; conversions: number; cpa: number | null; hasAccounts: boolean } | null> {
  const supabase = await getSupabase(client)
  const accounts = await getAdsAccounts(siteId, supabase)
  if (accounts.length === 0) return null
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const { data } = await supabase
    .from('ads_daily')
    .select('cost, conversions')
    .in('account_id', accounts.map((a) => a.id))
    .gte('date', monthStart)
  const spend = (data ?? []).reduce((s, r) => s + Number(r.cost), 0)
  const conversions = (data ?? []).reduce((s, r) => s + Number(r.conversions), 0)
  return { spend: Math.round(spend), conversions: Math.round(conversions), cpa: conversions > 0 ? Math.round(spend / conversions) : null, hasAccounts: true }
}
