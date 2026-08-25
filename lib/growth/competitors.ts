import { createClient } from '@/lib/supabase/service'
import { LABS_COST, competitorsForDomain, keywordSuggestions, rankedKeywords, relatedKeywords } from '@/lib/growth/labs'
import { recordApiSpend } from '@/lib/growth/enrich'
import type { SeoSite } from '@/lib/types'

/**
 * B2: competitor keyword sets and the gap view. "What do they rank for that
 * we do not" — the highest-value research question the module could not ask.
 */

export interface CompetitorSuggestion {
  domain: string
  source: 'serp' | 'labs'
  /** SERP: number of tracked keywords where the domain sits in the top 10. Labs: intersections. */
  strength: number
}

/** Candidate competitors: from parsed SERP states (free) and Labs (one call). */
export async function suggestCompetitors(site: SeoSite, includeLabs: boolean): Promise<CompetitorSuggestion[]> {
  const supabase = createClient()
  const siteHost = site.domain.toLowerCase().replace(/^www\./, '')
  const { data: keywords } = await supabase.from('seo_keywords').select('id').eq('site_id', site.id)
  const ids = (keywords ?? []).map((k) => k.id as string)
  const counts = new Map<string, number>()
  if (ids.length > 0) {
    const { data: states } = await supabase
      .from('seo_serp_state')
      .select('keyword_id, top_domains, captured_at')
      .in('keyword_id', ids)
      .order('captured_at', { ascending: false })
    const seen = new Set<string>()
    for (const s of states ?? []) {
      const kid = s.keyword_id as string
      if (seen.has(kid)) continue
      seen.add(kid)
      for (const d of new Set((s.top_domains as string[]) ?? [])) {
        if (d === siteHost || d.endsWith(`.${siteHost}`)) continue
        counts.set(d, (counts.get(d) ?? 0) + 1)
      }
    }
  }
  const { data: existing } = await supabase.from('seo_competitors').select('domain').eq('site_id', site.id)
  const known = new Set((existing ?? []).map((c) => c.domain as string))

  const out: CompetitorSuggestion[] = [...counts.entries()]
    .filter(([d]) => !known.has(d))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([domain, strength]) => ({ domain, source: 'serp', strength }))

  if (includeLabs) {
    try {
      const labs = await competitorsForDomain(site.domain, 15)
      await recordApiSpend(site.id, LABS_COST.competitors_per_call)
      for (const c of labs) {
        if (known.has(c.domain) || out.some((o) => o.domain === c.domain)) continue
        out.push({ domain: c.domain, source: 'labs', strength: c.intersections })
      }
    } catch {
      /* Labs failure must not hide the SERP-derived suggestions */
    }
  }
  return out
}

export async function addCompetitor(siteId: string, domain: string, addedBy: 'manual' | 'serp' | 'labs'): Promise<void> {
  const supabase = createClient()
  const clean = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
  if (!clean) throw new Error('Enter a domain')
  const { error } = await supabase
    .from('seo_competitors')
    .upsert({ site_id: siteId, domain: clean, added_by: addedBy, tracked: true }, { onConflict: 'site_id,domain' })
  if (error) throw new Error(error.message)
}

/** Pull one competitor's ranked keywords into seo_competitor_keywords. */
export async function pullCompetitorKeywords(siteId: string, domain: string, limit = 1000): Promise<number> {
  const supabase = createClient()
  const ranked = await rankedKeywords(domain, limit)
  await recordApiSpend(siteId, LABS_COST.ranked_keywords_per_call * Math.ceil(Math.max(1, ranked.length) / 1000))
  const now = new Date().toISOString()
  await supabase.from('seo_competitor_keywords').delete().eq('site_id', siteId).eq('competitor_domain', domain)
  const rows = ranked.map((r) => ({
    site_id: siteId,
    competitor_domain: domain,
    keyword: r.keyword,
    position: r.position,
    url: r.url,
    search_volume: r.search_volume,
    keyword_difficulty: r.keyword_difficulty,
    cpc: r.cpc,
    etv: r.etv,
    pulled_at: now,
  }))
  const seen = new Set<string>()
  const deduped = rows.filter((r) => (seen.has(r.keyword) ? false : (seen.add(r.keyword), true)))
  for (let i = 0; i < deduped.length; i += 500) {
    const { error } = await supabase
      .from('seo_competitor_keywords')
      .upsert(deduped.slice(i, i + 500), { onConflict: 'site_id,competitor_domain,keyword' })
    if (error) throw new Error(error.message)
  }
  await supabase
    .from('seo_competitors')
    .update({ last_pulled_at: now, keyword_count: deduped.length })
    .eq('site_id', siteId)
    .eq('domain', domain)
  return deduped.length
}

export interface GapKeyword {
  keyword: string
  search_volume: number | null
  keyword_difficulty: number | null
  cpc: number | null
  /** Competitors ranking top-20, with their position. */
  competitors: Array<{ domain: string; position: number | null; url: string | null }>
  our_position: number | null
  in_keyword_list: boolean
  /** Sum of competitors' ETV as a rough traffic-value figure. */
  etv: number
}

/** Keywords where ≥1 tracked competitor ranks top-20 and we do not (or rank > 20). */
export async function gapKeywords(siteId: string): Promise<GapKeyword[]> {
  const supabase = createClient()
  const { data: comps } = await supabase.from('seo_competitors').select('domain').eq('site_id', siteId).eq('tracked', true)
  const tracked = new Set((comps ?? []).map((c) => c.domain as string))
  if (tracked.size === 0) return []

  const rows: Array<{ competitor_domain: string; keyword: string; position: number | null; url: string | null; search_volume: number | null; keyword_difficulty: number | null; cpc: number | null; etv: number | null }> = []
  for (let offset = 0; offset < 100_000; offset += 5000) {
    const { data, error } = await supabase
      .from('seo_competitor_keywords')
      .select('competitor_domain, keyword, position, url, search_volume, keyword_difficulty, cpc, etv')
      .eq('site_id', siteId)
      .lte('position', 20)
      .range(offset, offset + 4999)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as typeof rows))
    if ((data ?? []).length < 5000) break
  }

  const { data: ours } = await supabase
    .from('seo_keywords')
    .select('keyword, gsc_position')
    .eq('site_id', siteId)
  const ourMap = new Map((ours ?? []).map((k) => [k.keyword as string, k.gsc_position as number | null]))

  const byKeyword = new Map<string, GapKeyword>()
  for (const r of rows) {
    if (!tracked.has(r.competitor_domain)) continue
    const entry = byKeyword.get(r.keyword) ?? {
      keyword: r.keyword,
      search_volume: r.search_volume,
      keyword_difficulty: r.keyword_difficulty,
      cpc: r.cpc,
      competitors: [],
      our_position: ourMap.has(r.keyword) ? ourMap.get(r.keyword) ?? null : null,
      in_keyword_list: ourMap.has(r.keyword),
      etv: 0,
    }
    entry.competitors.push({ domain: r.competitor_domain, position: r.position, url: r.url })
    entry.etv += r.etv ?? 0
    if (entry.search_volume === null && r.search_volume !== null) entry.search_volume = r.search_volume
    if (entry.keyword_difficulty === null && r.keyword_difficulty !== null) entry.keyword_difficulty = r.keyword_difficulty
    byKeyword.set(r.keyword, entry)
  }
  return [...byKeyword.values()]
    .filter((g) => g.our_position === null || g.our_position > 20)
    .sort((a, b) => b.competitors.length - a.competitors.length || (b.search_volume ?? 0) - (a.search_volume ?? 0))
}

/** Add gap keywords to the site's list, tagged with their origin. */
export async function addKeywordsFromGap(siteId: string, keywords: string[]): Promise<number> {
  const supabase = createClient()
  if (keywords.length === 0) return 0
  const { data: gap } = await supabase
    .from('seo_competitor_keywords')
    .select('keyword, search_volume, keyword_difficulty, cpc')
    .eq('site_id', siteId)
    .in('keyword', keywords)
  const metrics = new Map<string, { search_volume: number | null; keyword_difficulty: number | null; cpc: number | null }>()
  for (const g of gap ?? []) if (!metrics.has(g.keyword as string)) metrics.set(g.keyword as string, g as never)
  const { data: existing } = await supabase.from('seo_keywords').select('keyword').eq('site_id', siteId).in('keyword', keywords)
  const known = new Set((existing ?? []).map((k) => k.keyword as string))
  const rows = keywords
    .filter((k) => !known.has(k))
    .map((k) => {
      const m = metrics.get(k)
      return {
        site_id: siteId,
        keyword: k,
        source: 'competitor_gap',
        search_volume: m?.search_volume ?? null,
        keyword_difficulty: m?.keyword_difficulty ?? null,
        difficulty: m?.keyword_difficulty ?? null,
        cpc: m?.cpc ?? null,
        last_refreshed_at: new Date().toISOString(),
      }
    })
  if (rows.length === 0) return 0
  const { error } = await supabase.from('seo_keywords').insert(rows)
  if (error) throw new Error(error.message)
  return rows.length
}

/** Labs expansion on the research box: suggestions + related per seed. */
export async function expandSeeds(siteId: string, seeds: string[]): Promise<{ added: number; seen: number }> {
  const supabase = createClient()
  const { data: existing } = await supabase.from('seo_keywords').select('keyword').eq('site_id', siteId)
  const known = new Set((existing ?? []).map((k) => k.keyword as string))
  const rows: Array<Record<string, unknown>> = []
  let seen = 0
  const now = new Date().toISOString()
  for (const seed of seeds.slice(0, 5)) {
    const [suggestions, related] = await Promise.all([
      keywordSuggestions(seed, 150).catch(() => []),
      relatedKeywords(seed, 100).catch(() => []),
    ])
    await recordApiSpend(siteId, LABS_COST.suggestions_per_call * 2)
    for (const [source, list] of [['labs_suggestion', suggestions], ['labs_related', related]] as const) {
      for (const k of list) {
        seen += 1
        if (known.has(k.keyword)) continue
        known.add(k.keyword)
        rows.push({
          site_id: siteId,
          keyword: k.keyword,
          source,
          search_volume: k.search_volume,
          keyword_difficulty: k.keyword_difficulty,
          difficulty: k.keyword_difficulty,
          cpc: k.cpc,
          intent: k.intent,
          intent_source: k.intent ? 'dataforseo' : null,
          last_refreshed_at: now,
        })
      }
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('seo_keywords').insert(rows.slice(i, i + 500))
    if (error) throw new Error(error.message)
  }
  return { added: rows.length, seen }
}
