import { createClient } from '@/lib/supabase/service'
import type { AdsAccount } from '@/lib/types'

/**
 * E3: Meta Marketing API → ads_campaigns / ads_daily / ads_creatives.
 *
 * Access: a Business Manager SYSTEM USER token with ads_read
 * (META_SYSTEM_USER_TOKEN) — it does not expire the way a user token does,
 * which is what a cron needs. META_APP_ID / META_APP_SECRET are used for
 * appsecret_proof. If the app is not yet a Business app with ads_read this
 * goes through app review; treat as a long-lead item.
 *
 * Nightly, 28-day window with a 7-day re-pull built in (the whole window is
 * re-read each night, so attribution settling is absorbed automatically).
 *
 * There are no keywords in Meta and this file does not pretend otherwise: it
 * feeds demand-gen and creative learning only.
 *
 * Pin the Graph version with META_API_VERSION and verify against
 * https://developers.facebook.com/docs/graph-api/changelog before first sync.
 */

const API_VERSION = process.env.META_API_VERSION ?? 'v22.0'
const WINDOW_DAYS = 28

type Supabase = ReturnType<typeof createClient>

export function metaAdsConfigured(): boolean {
  return Boolean(process.env.META_SYSTEM_USER_TOKEN)
}

async function appSecretProof(token: string): Promise<string | null> {
  const secret = process.env.META_APP_SECRET
  if (!secret) return null
  const { createHmac } = await import('node:crypto')
  return createHmac('sha256', secret).update(token).digest('hex')
}

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = process.env.META_SYSTEM_USER_TOKEN
  if (!token) throw new Error('META_SYSTEM_USER_TOKEN is not configured')
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('access_token', token)
  const proof = await appSecretProof(token)
  if (proof) url.searchParams.set('appsecret_proof', proof)

  // Back off on the standard rate-limit codes rather than retrying tight.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url)
    if (res.ok) return (await res.json()) as T
    const body = await res.text().catch(() => '')
    const code = (() => {
      try {
        return (JSON.parse(body) as { error?: { code?: number } }).error?.code
      } catch {
        return undefined
      }
    })()
    if ((code === 4 || code === 17 || code === 32 || code === 613 || res.status === 429) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 15_000 * (attempt + 1)))
      continue
    }
    throw new Error(`Meta Graph ${path} failed (${res.status}): ${body.slice(0, 400)}`)
  }
  throw new Error(`Meta Graph ${path}: rate limited`)
}

/** Walk Graph API pagination. */
async function graphAll<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const out: T[] = []
  let after: string | undefined
  for (let page = 0; page < 20; page++) {
    const json = await graph<{ data?: T[]; paging?: { cursors?: { after?: string }; next?: string } }>(path, {
      ...params,
      limit: '200',
      ...(after ? { after } : {}),
    })
    out.push(...(json.data ?? []))
    if (!json.paging?.next || !json.paging.cursors?.after) break
    after = json.paging.cursors.after
  }
  return out
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function num(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 0
  return Number.isFinite(n) ? n : 0
}

interface Action {
  action_type?: string
  value?: string
}

const CONVERSION_ACTIONS = new Set(['purchase', 'lead', 'complete_registration', 'omni_purchase', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'offsite_conversion.fb_pixel_purchase'])

function conversionsOf(actions: Action[] | undefined): number {
  return (actions ?? []).filter((a) => a.action_type && CONVERSION_ACTIONS.has(a.action_type)).reduce((s, a) => s + num(a.value), 0)
}

function conversionValueOf(values: Action[] | undefined): number {
  return (values ?? []).filter((a) => a.action_type && CONVERSION_ACTIONS.has(a.action_type)).reduce((s, a) => s + num(a.value), 0)
}

export async function listMetaAdAccounts(): Promise<Array<{ id: string; name: string | null; currency: string | null }>> {
  const rows = await graphAll<{ id: string; account_id: string; name?: string; currency?: string }>('me/adaccounts', {
    fields: 'id,account_id,name,currency',
  })
  return rows.map((r) => ({ id: r.account_id, name: r.name ?? null, currency: r.currency ?? null }))
}

export interface MetaSyncResult {
  account: string
  campaigns: number
  daily: number
  creatives: number
}

export async function syncMetaAccount(account: AdsAccount): Promise<MetaSyncResult> {
  const supabase = createClient()
  const act = `act_${account.external_id.replace(/^act_/, '')}`
  const windowStart = isoDaysAgo(WINDOW_DAYS)
  const windowEnd = isoDaysAgo(1)
  const timeRange = JSON.stringify({ since: windowStart, until: windowEnd })

  // ── Campaigns ──
  const campaigns = await graphAll<{ id: string; name: string; status?: string; objective?: string; daily_budget?: string }>(
    `${act}/campaigns`,
    { fields: 'id,name,status,objective,daily_budget' }
  )
  const campaignIdMap = new Map<string, string>()
  for (const c of campaigns) {
    const { data } = await supabase
      .from('ads_campaigns')
      .upsert(
        {
          account_id: account.id,
          external_id: c.id,
          name: c.name,
          channel: c.objective?.toLowerCase() ?? null,
          status: c.status ?? null,
          daily_budget: c.daily_budget ? num(c.daily_budget) / 100 : null,
        },
        { onConflict: 'account_id,external_id' }
      )
      .select('id')
      .single()
    if (data) campaignIdMap.set(c.id, data.id as string)
  }

  // ── Daily, campaign level ──
  const dailyRows = await graphAll<{
    campaign_id: string
    date_start: string
    impressions?: string
    clicks?: string
    spend?: string
    actions?: Action[]
    action_values?: Action[]
  }>(`${act}/insights`, {
    level: 'campaign',
    time_increment: '1',
    time_range: timeRange,
    fields: 'campaign_id,impressions,clicks,spend,actions,action_values',
  })
  const daily = dailyRows
    .map((r) => ({
      account_id: account.id,
      campaign_id: campaignIdMap.get(r.campaign_id) ?? null,
      date: r.date_start,
      impressions: num(r.impressions),
      clicks: num(r.clicks),
      cost: num(r.spend),
      conversions: conversionsOf(r.actions),
      conversion_value: conversionValueOf(r.action_values),
    }))
    .filter((r) => r.campaign_id)
  for (let i = 0; i < daily.length; i += 500) {
    const { error } = await supabase.from('ads_daily').upsert(daily.slice(i, i + 500), { onConflict: 'account_id,campaign_key,date' })
    if (error) throw new Error(error.message)
  }

  // ── Creatives: metadata + ad-level insights ──
  const ads = await graphAll<{
    id: string
    name?: string
    status?: string
    adset_id?: string
    campaign_id?: string
    creative?: {
      title?: string
      body?: string
      thumbnail_url?: string
      object_type?: string
      object_story_spec?: {
        link_data?: { message?: string; name?: string; link?: string }
        video_data?: { message?: string; title?: string; call_to_action?: { value?: { link?: string } } }
      }
      asset_feed_spec?: { bodies?: Array<{ text?: string }>; titles?: Array<{ text?: string }>; link_urls?: Array<{ website_url?: string }> }
    }
  }>(`${act}/ads`, {
    fields:
      'id,name,status,adset_id,campaign_id,creative{title,body,thumbnail_url,object_type,object_story_spec,asset_feed_spec}',
  })

  const insights = await graphAll<{
    ad_id: string
    impressions?: string
    reach?: string
    frequency?: string
    clicks?: string
    spend?: string
    ctr?: string
    actions?: Action[]
    action_values?: Action[]
  }>(`${act}/insights`, {
    level: 'ad',
    time_range: timeRange,
    fields: 'ad_id,impressions,reach,frequency,clicks,spend,ctr,actions,action_values',
  })
  const insightById = new Map(insights.map((i) => [i.ad_id, i]))

  const { data: existingCreatives } = await supabase
    .from('ads_creatives')
    .select('external_id, first_week_ctr, first_seen_at')
    .eq('account_id', account.id)
  const existing = new Map((existingCreatives ?? []).map((c) => [c.external_id as string, c]))

  let creatives = 0
  for (const ad of ads) {
    const ins = insightById.get(ad.id)
    const spec = ad.creative?.object_story_spec
    const feed = ad.creative?.asset_feed_spec
    const primaryText = spec?.link_data?.message ?? spec?.video_data?.message ?? ad.creative?.body ?? feed?.bodies?.[0]?.text ?? null
    const headline = spec?.link_data?.name ?? spec?.video_data?.title ?? ad.creative?.title ?? feed?.titles?.[0]?.text ?? null
    const destination = spec?.link_data?.link ?? spec?.video_data?.call_to_action?.value?.link ?? feed?.link_urls?.[0]?.website_url ?? null
    const ctr = ins?.ctr !== undefined ? num(ins.ctr) : null
    const prev = existing.get(ad.id)
    const firstSeen = prev?.first_seen_at ? new Date(prev.first_seen_at as string) : new Date()
    // Baseline: the CTR observed while the creative was within its first week of being seen by us.
    const withinFirstWeek = Date.now() - firstSeen.getTime() <= 7 * 86400_000
    const firstWeekCtr = prev?.first_week_ctr ?? (withinFirstWeek ? ctr : null)

    const { error } = await supabase.from('ads_creatives').upsert(
      {
        account_id: account.id,
        external_id: ad.id,
        adset_external_id: ad.adset_id ?? null,
        campaign_id: ad.campaign_id ? campaignIdMap.get(ad.campaign_id) ?? null : null,
        name: ad.name ?? null,
        format: ad.creative?.object_type?.toLowerCase() ?? (spec?.video_data ? 'video' : spec?.link_data ? 'image' : null),
        primary_text: primaryText,
        headline,
        destination_url: destination,
        thumbnail_url: ad.creative?.thumbnail_url ?? null,
        status: ad.status ?? null,
        impressions: num(ins?.impressions),
        reach: num(ins?.reach),
        frequency: ins?.frequency !== undefined ? num(ins.frequency) : null,
        clicks: num(ins?.clicks),
        spend: num(ins?.spend),
        conversions: conversionsOf(ins?.actions),
        conversion_value: conversionValueOf(ins?.action_values),
        ctr,
        first_week_ctr: firstWeekCtr,
        first_seen_at: firstSeen.toISOString(),
        window_start: windowStart,
        window_end: windowEnd,
      },
      { onConflict: 'account_id,external_id' }
    )
    if (error) throw new Error(error.message)
    creatives += 1
  }

  await supabase
    .from('ads_accounts')
    .update({ last_synced_at: new Date().toISOString(), last_error: null })
    .eq('id', account.id)

  return { account: account.external_id, campaigns: campaignIdMap.size, daily: daily.length, creatives }
}

export async function syncAllMetaAccounts(supabase: Supabase = createClient()): Promise<{
  synced: MetaSyncResult[]
  errors: Array<{ account: string; error: string }>
}> {
  const synced: MetaSyncResult[] = []
  const errors: Array<{ account: string; error: string }> = []
  if (!metaAdsConfigured()) {
    errors.push({ account: '*', error: 'META_SYSTEM_USER_TOKEN not configured' })
    return { synced, errors }
  }
  const { data: accounts } = await supabase.from('ads_accounts').select('*').eq('platform', 'meta').eq('status', 'active')
  for (const account of (accounts ?? []) as AdsAccount[]) {
    try {
      synced.push(await syncMetaAccount(account))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ account: account.external_id, error: message })
      await supabase.from('ads_accounts').update({ last_error: message }).eq('id', account.id)
    }
  }
  return { synced, errors }
}
