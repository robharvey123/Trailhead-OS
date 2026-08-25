import { LANGUAGE_CODE, UK_LOCATION_CODE, dfsFetch } from '@/lib/growth/dataforseo'

/**
 * DataForSEO Labs wrappers (Growth module). Labs is Live-only — no Standard
 * queue exists — but every endpoint here batches (up to 1000 keywords per
 * call) and prices in fractions of a penny per keyword, so calls run from
 * crons and explicit user actions, never per render.
 *
 * Field names inside result[].items[] vary between Labs endpoints; every
 * reader below is defensive and verified against the live docs at the time
 * of writing. Re-check `keyword_properties` / `search_intent_info` shapes if
 * DataForSEO changes them.
 */

const BATCH = 1000

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// ── A1: bulk keyword difficulty ──────────────────────────────────────────────

interface KdItem {
  keyword: string
  keyword_difficulty: number | null
}

/** Organic keyword difficulty, 0-100, keyed by lowercase keyword. */
export async function bulkKeywordDifficulty(keywords: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  for (const batch of chunk(keywords, BATCH)) {
    if (batch.length === 0) continue
    const json = await dfsFetch<{ items: KdItem[] | null }>(
      '/dataforseo_labs/google/bulk_keyword_difficulty/live',
      [{ keywords: batch, location_code: UK_LOCATION_CODE, language_code: LANGUAGE_CODE }]
    )
    for (const task of json.tasks ?? []) {
      for (const result of task.result ?? []) {
        for (const item of result.items ?? []) {
          if (item.keyword && typeof item.keyword_difficulty === 'number') {
            out.set(item.keyword.toLowerCase(), item.keyword_difficulty)
          }
        }
      }
    }
  }
  return out
}

// ── A1: search intent ────────────────────────────────────────────────────────

export interface IntentResult {
  label: string
  probability: number | null
  secondary: string[]
}

interface IntentItem {
  keyword: string
  keyword_intent?: { label?: string; probability?: number } | null
  secondary_keyword_intents?: Array<{ label?: string; probability?: number }> | null
}

export async function searchIntent(keywords: string[]): Promise<Map<string, IntentResult>> {
  const out = new Map<string, IntentResult>()
  for (const batch of chunk(keywords, BATCH)) {
    if (batch.length === 0) continue
    const json = await dfsFetch<{ items: IntentItem[] | null }>(
      '/dataforseo_labs/google/search_intent/live',
      [{ keywords: batch, language_code: LANGUAGE_CODE }]
    )
    for (const task of json.tasks ?? []) {
      for (const result of task.result ?? []) {
        for (const item of result.items ?? []) {
          const label = item.keyword_intent?.label
          if (!item.keyword || !label) continue
          out.set(item.keyword.toLowerCase(), {
            label,
            probability: item.keyword_intent?.probability ?? null,
            secondary: (item.secondary_keyword_intents ?? [])
              .map((s) => s.label)
              .filter((s): s is string => Boolean(s)),
          })
        }
      }
    }
  }
  return out
}

// ── B2: competitors and ranked keywords ──────────────────────────────────────

export interface CompetitorDomain {
  domain: string
  intersections: number
  avg_position: number | null
  etv: number | null
}

interface CompetitorItem {
  domain: string
  avg_position?: number | null
  intersections?: number | null
  full_domain_metrics?: { organic?: { etv?: number | null } } | null
}

/** Domains that share the most SERPs with `target`. */
export async function competitorsForDomain(target: string, limit = 20): Promise<CompetitorDomain[]> {
  const json = await dfsFetch<{ items: CompetitorItem[] | null }>(
    '/dataforseo_labs/google/competitors_domain/live',
    [
      {
        target,
        location_code: UK_LOCATION_CODE,
        language_code: LANGUAGE_CODE,
        limit,
        exclude_top_domains: true,
        ignore_synonyms: true,
      },
    ]
  )
  const items = json.tasks?.[0]?.result?.[0]?.items ?? []
  return items
    .filter((i) => i.domain && i.domain !== target)
    .map((i) => ({
      domain: i.domain,
      intersections: i.intersections ?? 0,
      avg_position: i.avg_position ?? null,
      etv: i.full_domain_metrics?.organic?.etv ?? null,
    }))
}

export interface RankedKeyword {
  keyword: string
  position: number | null
  url: string | null
  search_volume: number | null
  keyword_difficulty: number | null
  cpc: number | null
  etv: number | null
}

interface RankedItem {
  keyword_data?: {
    keyword?: string
    keyword_info?: { search_volume?: number | null; cpc?: number | null } | null
    keyword_properties?: { keyword_difficulty?: number | null } | null
  } | null
  ranked_serp_element?: {
    serp_item?: { rank_group?: number | null; url?: string | null; etv?: number | null } | null
  } | null
}

/** Keywords a domain ranks for (top `maxPosition`), paged to `limit`. */
export async function rankedKeywords(
  target: string,
  limit = 1000,
  maxPosition = 30
): Promise<RankedKeyword[]> {
  const out: RankedKeyword[] = []
  let offset = 0
  const pageSize = Math.min(limit, 1000)
  while (out.length < limit) {
    const json = await dfsFetch<{ items: RankedItem[] | null; total_count?: number }>(
      '/dataforseo_labs/google/ranked_keywords/live',
      [
        {
          target,
          location_code: UK_LOCATION_CODE,
          language_code: LANGUAGE_CODE,
          limit: pageSize,
          offset,
          filters: ['ranked_serp_element.serp_item.rank_group', '<=', maxPosition],
          order_by: ['keyword_data.keyword_info.search_volume,desc'],
          ignore_synonyms: true,
        },
      ]
    )
    const result = json.tasks?.[0]?.result?.[0]
    const items = result?.items ?? []
    for (const item of items) {
      const keyword = item.keyword_data?.keyword?.toLowerCase()
      if (!keyword) continue
      out.push({
        keyword,
        position: item.ranked_serp_element?.serp_item?.rank_group ?? null,
        url: item.ranked_serp_element?.serp_item?.url ?? null,
        search_volume: item.keyword_data?.keyword_info?.search_volume ?? null,
        keyword_difficulty: item.keyword_data?.keyword_properties?.keyword_difficulty ?? null,
        cpc: item.keyword_data?.keyword_info?.cpc ?? null,
        etv: item.ranked_serp_element?.serp_item?.etv ?? null,
      })
    }
    if (items.length < pageSize) break
    offset += pageSize
  }
  return out.slice(0, limit)
}

// ── B2: keyword expansion ────────────────────────────────────────────────────

export interface ExpandedKeyword {
  keyword: string
  search_volume: number | null
  keyword_difficulty: number | null
  cpc: number | null
  intent: string | null
}

interface SuggestionItem {
  keyword?: string
  keyword_info?: { search_volume?: number | null; cpc?: number | null } | null
  keyword_properties?: { keyword_difficulty?: number | null } | null
  search_intent_info?: { main_intent?: string | null } | null
  /** related_keywords wraps the same shape under keyword_data. */
  keyword_data?: SuggestionItem | null
}

function readSuggestion(item: SuggestionItem): ExpandedKeyword | null {
  const data = item.keyword_data ?? item
  const keyword = data.keyword?.toLowerCase()
  if (!keyword) return null
  return {
    keyword,
    search_volume: data.keyword_info?.search_volume ?? null,
    keyword_difficulty: data.keyword_properties?.keyword_difficulty ?? null,
    cpc: data.keyword_info?.cpc ?? null,
    intent: data.search_intent_info?.main_intent ?? null,
  }
}

/** Long-tail suggestions containing the seed (keyword_suggestions). */
export async function keywordSuggestions(seed: string, limit = 200): Promise<ExpandedKeyword[]> {
  const json = await dfsFetch<{ items: SuggestionItem[] | null }>(
    '/dataforseo_labs/google/keyword_suggestions/live',
    [
      {
        keyword: seed,
        location_code: UK_LOCATION_CODE,
        language_code: LANGUAGE_CODE,
        limit,
        include_seed_keyword: false,
        ignore_synonyms: true,
      },
    ]
  )
  const items = json.tasks?.[0]?.result?.[0]?.items ?? []
  return items.map(readSuggestion).filter((k): k is ExpandedKeyword => Boolean(k))
}

/** Semantically related keywords (related_keywords, depth 2 ≈ searches related to). */
export async function relatedKeywords(seed: string, limit = 200): Promise<ExpandedKeyword[]> {
  const json = await dfsFetch<{ items: SuggestionItem[] | null }>(
    '/dataforseo_labs/google/related_keywords/live',
    [
      {
        keyword: seed,
        location_code: UK_LOCATION_CODE,
        language_code: LANGUAGE_CODE,
        limit,
        depth: 2,
        ignore_synonyms: true,
      },
    ]
  )
  const items = json.tasks?.[0]?.result?.[0]?.items ?? []
  return items.map(readSuggestion).filter((k): k is ExpandedKeyword => Boolean(k))
}

// ── B3: historical search volume ─────────────────────────────────────────────

export interface MonthlyVolume {
  year: number
  month: number
  search_volume: number
}

interface HistoricalItem {
  keyword?: string
  keyword_info?: {
    monthly_searches?: Array<{ year?: number; month?: number; search_volume?: number | null }> | null
  } | null
}

export async function historicalSearchVolume(keywords: string[]): Promise<Map<string, MonthlyVolume[]>> {
  const out = new Map<string, MonthlyVolume[]>()
  for (const batch of chunk(keywords, 700)) {
    if (batch.length === 0) continue
    const json = await dfsFetch<{ items: HistoricalItem[] | null }>(
      '/dataforseo_labs/google/historical_search_volume/live',
      [{ keywords: batch, location_code: UK_LOCATION_CODE, language_code: LANGUAGE_CODE }]
    )
    for (const task of json.tasks ?? []) {
      for (const result of task.result ?? []) {
        for (const item of result.items ?? []) {
          const keyword = item.keyword?.toLowerCase()
          if (!keyword) continue
          const months = (item.keyword_info?.monthly_searches ?? [])
            .filter((m) => typeof m.year === 'number' && typeof m.month === 'number')
            .map((m) => ({ year: m.year as number, month: m.month as number, search_volume: m.search_volume ?? 0 }))
          if (months.length > 0) out.set(keyword, months)
        }
      }
    }
  }
  return out
}

/** Approximate USD cost of a Labs call — for the spend guard. Prices from the
 *  DataForSEO pricing page at time of writing; keep in one place. */
export const LABS_COST = {
  bulk_kd_per_keyword: 0.0001,
  intent_per_keyword: 0.0001,
  historical_per_keyword: 0.0002,
  ranked_keywords_per_call: 0.011,
  competitors_per_call: 0.011,
  suggestions_per_call: 0.011,
} as const
