import { createClient } from '@/lib/supabase/service'
import { dfsFetch } from '@/lib/growth/dataforseo'
import { recordApiSpend } from '@/lib/growth/enrich'
import { topPagesByImpressions } from '@/lib/growth/pages'
import type { SeoSite } from '@/lib/types'

/**
 * C1: DataForSEO OnPage crawl → seo_page_issues, plus Lighthouse Core Web
 * Vitals on the top pages by impressions. Monthly per site (growth-crawl
 * cron) and on demand ("Recrawl"). The crawl is asynchronous: task_post now,
 * poll summary until crawl_progress = finished, then pull pages/links/dupes.
 *
 * Pricing is per page crawled — max_crawl_pages is a site setting (default 200).
 */

const ONPAGE_COST_PER_PAGE = 0.000125 // approximate; check the pricing page
const LIGHTHOUSE_COST = 0.005

type Supabase = ReturnType<typeof createClient>

export type IssueType =
  | 'missing_title'
  | 'duplicate_title'
  | 'missing_meta_description'
  | 'duplicate_meta_description'
  | 'missing_h1'
  | 'thin_content'
  | 'broken_internal_link'
  | 'redirect_chain'
  | 'canonical_mismatch'
  | 'noindex_with_impressions'
  | 'orphan_page'
  | 'slow_lcp'

const SEVERITY: Record<IssueType, 'critical' | 'high' | 'medium' | 'low'> = {
  noindex_with_impressions: 'critical',
  broken_internal_link: 'high',
  canonical_mismatch: 'high',
  redirect_chain: 'medium',
  missing_title: 'high',
  duplicate_title: 'medium',
  missing_h1: 'medium',
  missing_meta_description: 'low',
  duplicate_meta_description: 'low',
  thin_content: 'medium',
  orphan_page: 'medium',
  slow_lcp: 'high',
}

const ISSUE_WEIGHT: Record<'critical' | 'high' | 'medium' | 'low', number> = { critical: 5, high: 3, medium: 1.5, low: 0.5 }

/** Kick off a crawl. Stores the task id on the site so the next cron tick can collect. */
export async function startCrawl(site: SeoSite): Promise<string> {
  const json = await dfsFetch<never>('/on_page/task_post', [
    {
      target: site.domain,
      max_crawl_pages: site.max_crawl_pages ?? 200,
      enable_javascript: true,
      load_resources: false,
      calculate_keyword_density: false,
      store_raw_html: false,
      tag: `crawl:${site.id}`,
    },
  ])
  const task = json.tasks?.[0]
  if (!task || task.status_code !== 20100) throw new Error(`OnPage task rejected: ${task?.status_message ?? 'no task'}`)
  await createClient().from('seo_sites').update({ crawl_task_id: task.id }).eq('id', site.id)
  return task.id
}

interface SummaryResult {
  crawl_progress?: string
  crawl_status?: { pages_crawled?: number }
  domain_info?: { total_pages?: number }
}

interface PageItem {
  url?: string
  status_code?: number
  meta?: {
    title?: string | null
    description?: string | null
    htags?: { h1?: string[] } | null
    canonical?: string | null
    content?: { plain_text_word_count?: number } | null
  } | null
  checks?: Record<string, boolean> | null
  page_timing?: { largest_contentful_paint?: number } | null
  onpage_score?: number
}

interface LinkItem {
  link_from?: string
  link_to?: string
  page_to_status_code?: number
}

interface DuplicateTag {
  accumulator?: string
  pages?: Array<{ url?: string }>
  total_count?: number
}

async function pagesForTask(taskId: string): Promise<PageItem[]> {
  const out: PageItem[] = []
  for (let offset = 0; offset < 5000; offset += 1000) {
    const json = await dfsFetch<{ items: PageItem[] | null }>('/on_page/pages', [{ id: taskId, limit: 1000, offset }])
    const items = json.tasks?.[0]?.result?.[0]?.items ?? []
    out.push(...items)
    if (items.length < 1000) break
  }
  return out
}

async function brokenLinksForTask(taskId: string): Promise<LinkItem[]> {
  const json = await dfsFetch<{ items: LinkItem[] | null }>('/on_page/links', [
    { id: taskId, limit: 1000, filters: ['page_to_status_code', '>=', 400] },
  ])
  return json.tasks?.[0]?.result?.[0]?.items ?? []
}

async function duplicateTagsForTask(taskId: string, type: 'duplicate_title' | 'duplicate_description'): Promise<DuplicateTag[]> {
  const json = await dfsFetch<{ items: DuplicateTag[] | null }>('/on_page/duplicate_tags', [{ id: taskId, type, limit: 200 }])
  return json.tasks?.[0]?.result?.[0]?.items ?? []
}

/** Poll + collect. Returns 'pending' if the crawl has not finished. */
export async function collectCrawl(site: SeoSite): Promise<'pending' | { issues: number; pages: number }> {
  if (!site.crawl_task_id) throw new Error('No crawl in progress')
  const supabase = createClient()
  const summary = await dfsFetch<SummaryResult>(`/on_page/summary/${site.crawl_task_id}`)
  const result = summary.tasks?.[0]?.result?.[0]
  if (!result || result.crawl_progress !== 'finished') return 'pending'

  const [pages, brokenLinks, dupTitles, dupDescs] = await Promise.all([
    pagesForTask(site.crawl_task_id),
    brokenLinksForTask(site.crawl_task_id),
    duplicateTagsForTask(site.crawl_task_id, 'duplicate_title'),
    duplicateTagsForTask(site.crawl_task_id, 'duplicate_description'),
  ])
  await recordApiSpend(site.id, pages.length * ONPAGE_COST_PER_PAGE)

  // Pages with impressions, for the noindex check and orphan severity.
  const { data: impressed } = await supabase
    .from('seo_gsc_query_page')
    .select('page')
    .eq('site_id', site.id)
    .gt('impressions', 0)
    .gte('date', new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10))
    .limit(10000)
  const withImpressions = new Set((impressed ?? []).map((r) => r.page as string))

  const inbound = new Map<string, number>()
  const found: Array<{ url: string; issue_type: IssueType; detail: string }> = []

  for (const page of pages) {
    const url = page.url
    if (!url || (page.status_code ?? 0) >= 400) continue
    const checks = page.checks ?? {}
    const meta = page.meta ?? {}
    if (!meta.title) found.push({ url, issue_type: 'missing_title', detail: 'No <title> element' })
    if (!meta.description) found.push({ url, issue_type: 'missing_meta_description', detail: 'No meta description' })
    if (!meta.htags?.h1 || meta.htags.h1.length === 0) found.push({ url, issue_type: 'missing_h1', detail: 'No H1' })
    const words = meta.content?.plain_text_word_count ?? null
    if (words !== null && words < 200 && withImpressions.has(url))
      found.push({ url, issue_type: 'thin_content', detail: `${words} words on a page that earns impressions` })
    if (checks.is_redirect && checks.redirect_chain) found.push({ url, issue_type: 'redirect_chain', detail: 'Reached through a redirect chain' })
    if (meta.canonical && meta.canonical !== url && !checks.canonical_to_redirect)
      found.push({ url, issue_type: 'canonical_mismatch', detail: `Canonical points to ${meta.canonical}` })
    if ((checks.no_index || checks.meta_robots_noindex) && withImpressions.has(url))
      found.push({ url, issue_type: 'noindex_with_impressions', detail: 'noindex on a page Search Console still shows impressions for' })
    if (page.page_timing?.largest_contentful_paint && page.page_timing.largest_contentful_paint > 4000)
      found.push({ url, issue_type: 'slow_lcp', detail: `LCP ${Math.round(page.page_timing.largest_contentful_paint)}ms (crawler-measured)` })
  }

  for (const link of brokenLinks) {
    if (link.link_from && link.link_to)
      found.push({ url: link.link_from, issue_type: 'broken_internal_link', detail: `Links to ${link.link_to} (${link.page_to_status_code})` })
  }
  for (const [type, list] of [['duplicate_title', dupTitles], ['duplicate_meta_description', dupDescs]] as const) {
    for (const dup of list) {
      for (const p of dup.pages ?? []) {
        if (p.url) found.push({ url: p.url, issue_type: type, detail: `Shared with ${(dup.total_count ?? (dup.pages?.length ?? 1)) - 1} other page(s): "${(dup.accumulator ?? '').slice(0, 80)}"` })
      }
    }
  }

  // Orphans: crawled pages with no inbound internal links (from the links endpoint, non-broken).
  const linksJson = await dfsFetch<{ items: LinkItem[] | null }>('/on_page/links', [{ id: site.crawl_task_id, limit: 1000, filters: ['page_to_status_code', '<', 400] }])
  for (const l of linksJson.tasks?.[0]?.result?.[0]?.items ?? []) if (l.link_to) inbound.set(l.link_to, (inbound.get(l.link_to) ?? 0) + 1)
  for (const page of pages) {
    if (page.url && (page.status_code ?? 0) < 400 && !inbound.has(page.url) && !page.url.replace(/\/$/, '').endsWith(site.domain))
      found.push({ url: page.url, issue_type: 'orphan_page', detail: 'In the crawl but no internal page links to it' })
  }

  // Upsert: seen issues refresh last_seen_at, missing ones resolve.
  const now = new Date().toISOString()
  const { data: open } = await supabase.from('seo_page_issues').select('id, url, issue_type').eq('site_id', site.id).is('resolved_at', null)
  const stillOpen = new Set(found.map((f) => `${f.url}|${f.issue_type}`))
  for (const o of open ?? []) {
    if (!stillOpen.has(`${o.url}|${o.issue_type}`)) await supabase.from('seo_page_issues').update({ resolved_at: now }).eq('id', o.id)
  }
  const seen = new Set<string>()
  const rows = found
    .filter((f) => (seen.has(`${f.url}|${f.issue_type}`) ? false : (seen.add(`${f.url}|${f.issue_type}`), true)))
    .map((f) => ({ site_id: site.id, url: f.url, issue_type: f.issue_type, severity: SEVERITY[f.issue_type], detail: f.detail, last_seen_at: now, resolved_at: null }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('seo_page_issues').upsert(rows.slice(i, i + 500), { onConflict: 'site_id,url,issue_type' })
    if (error) throw new Error(error.message)
  }

  await supabase.from('seo_sites').update({ last_crawl_at: now, crawl_task_id: null }).eq('id', site.id)
  return { issues: rows.length, pages: pages.length }
}

/** Lighthouse on the top pages by impressions (Live endpoint, one call per URL). */
export async function measureVitals(site: SeoSite, limit = 10): Promise<number> {
  const supabase = createClient()
  const urls = await topPagesByImpressions(site.id, limit)
  let measured = 0
  for (const url of urls) {
    try {
      const json = await dfsFetch<{
        categories?: { performance?: { score?: number } }
        audits?: Record<string, { numericValue?: number }>
      }>('/on_page/lighthouse/live/json', [{ url, for_mobile: true, categories: ['performance'] }])
      const r = json.tasks?.[0]?.result?.[0]
      if (!r) continue
      await recordApiSpend(site.id, LIGHTHOUSE_COST)
      const audit = (k: string) => r.audits?.[k]?.numericValue
      await supabase.from('seo_page_vitals').upsert(
        {
          site_id: site.id,
          url,
          measured_at: new Date().toISOString(),
          performance_score: r.categories?.performance?.score !== undefined ? Math.round((r.categories.performance.score ?? 0) * 100) : null,
          lcp_ms: audit('largest-contentful-paint') !== undefined ? Math.round(audit('largest-contentful-paint') as number) : null,
          cls: audit('cumulative-layout-shift') ?? null,
          inp_ms: audit('interaction-to-next-paint') !== undefined ? Math.round(audit('interaction-to-next-paint') as number) : null,
          tbt_ms: audit('total-blocking-time') !== undefined ? Math.round(audit('total-blocking-time') as number) : null,
        },
        { onConflict: 'site_id,url' }
      )
      measured += 1
    } catch {
      /* one slow page must not stop the rest */
    }
  }
  return measured
}

/** Weighted open-issue total for the Growth Score. */
export async function technicalScoreInput(siteId: string, supabase: Supabase = createClient()): Promise<{ weighted: number; open: number; critical: number } | null> {
  const { data: site } = await supabase.from('seo_sites').select('last_crawl_at').eq('id', siteId).maybeSingle()
  if (!site?.last_crawl_at) return null
  const { data } = await supabase.from('seo_page_issues').select('severity').eq('site_id', siteId).is('resolved_at', null)
  const rows = (data ?? []) as Array<{ severity: 'critical' | 'high' | 'medium' | 'low' }>
  return {
    weighted: rows.reduce((s, r) => s + ISSUE_WEIGHT[r.severity], 0),
    open: rows.length,
    critical: rows.filter((r) => r.severity === 'critical').length,
  }
}

/** Cron: start monthly crawls, collect finished ones, measure vitals after collect. */
export async function runCrawls(): Promise<{ started: string[]; collected: string[]; pending: string[]; errors: Array<{ site: string; error: string }> }> {
  const supabase = createClient()
  const { data: sites } = await supabase.from('seo_sites').select('*')
  const out = { started: [] as string[], collected: [] as string[], pending: [] as string[], errors: [] as Array<{ site: string; error: string }> }
  const monthAgo = Date.now() - 30 * 86400_000
  for (const site of (sites ?? []) as SeoSite[]) {
    try {
      if (site.crawl_task_id) {
        const r = await collectCrawl(site)
        if (r === 'pending') out.pending.push(site.domain)
        else {
          out.collected.push(site.domain)
          await measureVitals(site)
        }
      } else if (!site.last_crawl_at || Date.parse(site.last_crawl_at) < monthAgo) {
        await startCrawl(site)
        out.started.push(site.domain)
      }
    } catch (err) {
      out.errors.push({ site: site.domain, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return out
}
