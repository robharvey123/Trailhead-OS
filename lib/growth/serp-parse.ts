/**
 * Turn a raw DataForSEO SERP snapshot into the small set of facts the module
 * actually uses: true organic position for our domain, the top-10 URL/domain
 * set (SERP-overlap clustering), SERP feature presence (AI Overview, featured
 * snippet, PAA) and whether the AI Overview cites us.
 *
 * DataForSEO item shapes vary by type; every field read here is optional and
 * the parser degrades to "absent" rather than throwing.
 */

export interface SerpItem {
  type?: string
  rank_group?: number
  rank_absolute?: number
  title?: string
  url?: string
  domain?: string
  description?: string
  /** PAA children, AI Overview parts, etc. */
  items?: Array<Record<string, unknown>>
  /** ai_overview: cited sources */
  references?: Array<{ url?: string; domain?: string; source?: string }>
}

export interface ParsedSerp {
  our_position: number | null
  our_url: string | null
  top_urls: string[]
  top_domains: string[]
  item_types: string[]
  ai_overview: boolean
  ai_overview_cites_us: boolean
  ai_overview_urls: string[]
  featured_snippet_domain: string | null
  paa_count: number
  paa_questions: string[]
}

export function normaliseHost(input: string | null | undefined): string {
  if (!input) return ''
  return input
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}

function hostOfUrl(url: string | undefined): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return normaliseHost(url)
  }
}

function isOurs(siteHost: string, url?: string, domain?: string): boolean {
  const host = domain ? normaliseHost(domain) : hostOfUrl(url)
  return host === siteHost || host.endsWith(`.${siteHost}`)
}

/** Collect every URL referenced inside an AI Overview item, recursively. */
function aiOverviewUrls(item: SerpItem): string[] {
  const urls = new Set<string>()
  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 4) return
    const record = node as Record<string, unknown>
    if (typeof record.url === 'string' && record.url.startsWith('http')) urls.add(record.url)
    for (const value of Object.values(record)) {
      if (Array.isArray(value)) value.forEach((v) => visit(v, depth + 1))
      else if (value && typeof value === 'object') visit(value, depth + 1)
    }
  }
  visit(item.references, 0)
  visit(item.items, 0)
  return [...urls]
}

export function parseSnapshot(
  siteDomain: string,
  results: { item_types?: string[]; items?: Array<Record<string, unknown>> | null } | null | undefined
): ParsedSerp {
  const siteHost = normaliseHost(siteDomain)
  const items = ((results?.items ?? []) as SerpItem[]).filter(Boolean)
  const organic = items
    .filter((i) => i.type === 'organic' && i.url)
    .sort((a, b) => (a.rank_group ?? 999) - (b.rank_group ?? 999))

  const top = organic.slice(0, 10)
  const top_urls = top.map((i) => i.url as string)
  const top_domains = [...new Set(top.map((i) => normaliseHost(i.domain) || hostOfUrl(i.url)).filter(Boolean))]

  let our_position: number | null = null
  let our_url: string | null = null
  organic.forEach((item, idx) => {
    if (our_position !== null) return
    if (isOurs(siteHost, item.url, item.domain)) {
      our_position = item.rank_group ?? idx + 1
      our_url = item.url ?? null
    }
  })

  const itemTypes = results?.item_types ?? [...new Set(items.map((i) => i.type).filter((t): t is string => Boolean(t)))]

  const aiItem = items.find((i) => i.type === 'ai_overview')
  const ai_overview_urls = aiItem ? aiOverviewUrls(aiItem) : []
  const ai_overview_cites_us = ai_overview_urls.some((u) => isOurs(siteHost, u))

  const snippet = items.find((i) => i.type === 'featured_snippet')
  const featured_snippet_domain = snippet ? normaliseHost(snippet.domain) || hostOfUrl(snippet.url) || null : null

  const paaQuestions = items
    .filter((i) => i.type === 'people_also_ask')
    .flatMap((i) => i.items ?? [])
    .map((q) => (typeof q.title === 'string' ? q.title : typeof q.question === 'string' ? q.question : null))
    .filter((q): q is string => Boolean(q))

  return {
    our_position,
    our_url,
    top_urls,
    top_domains,
    item_types: itemTypes,
    ai_overview: Boolean(aiItem),
    ai_overview_cites_us,
    ai_overview_urls,
    featured_snippet_domain,
    paa_count: paaQuestions.length,
    paa_questions: paaQuestions,
  }
}
