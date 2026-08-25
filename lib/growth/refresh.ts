import { z } from 'zod'
import { anthropic, ANTHROPIC_MODELS } from '@/lib/anthropic/client'
import { createClient } from '@/lib/supabase/service'
import { stripFences, textOf } from '@/lib/growth/ai'
import { CTR_MODEL_LABEL } from '@/lib/growth/ctr'
import { fetchPageOutline, type PageOutline } from '@/lib/growth/page-fetch'
import { pageStats, type PageStats } from '@/lib/growth/pages'
import { requestSerpSnapshots } from '@/lib/growth/keywords'
import type { SeoSite } from '@/lib/types'

/**
 * D2: the refresh worksheet — one per URL, where a page refresh actually gets
 * done. Stored in seo_page_refreshes so it is not regenerated on every visit.
 *
 * Contents: the page's 28-day numbers, every query it could move (with
 * modelled upside), what the page has now, what the winners have (headings on
 * 3+ of the top 5 that this page lacks), unanswered PAA questions, and a
 * model-produced change list with persisted checkboxes.
 */

export interface CompetitorOutline {
  url: string
  title: string | null
  headings: string[]
}

export interface RefreshChangeList {
  title: { current: string | null; proposed: string; length: number }
  meta_description: { current: string | null; proposed: string; length: number }
  sections_to_add: Array<{ heading: string; covers: string; position_hint: string }>
  internal_links_to_add: Array<{ from_url: string; anchor: string }>
  remove_or_merge: Array<{ what: string; why: string }>
}

export interface RefreshPayload {
  url: string
  primary_query: string | null
  stats: Omit<PageStats, 'queries'> & { queries: PageStats['queries'] }
  page: PageOutline | null
  winners: CompetitorOutline[]
  /** Headings on ≥3 of the top 5 that this page lacks. */
  gap_headings: string[]
  unanswered_questions: string[]
  serp_snapshot_status: 'ready' | 'queued' | 'none'
  quality_score_note: string | null
  change_list: RefreshChangeList | null
  ctr_model_label: string
}

export interface RefreshWorksheet {
  id: string
  site_id: string
  url: string
  generated_at: string
  payload: RefreshPayload
  checked: Record<string, boolean>
  status: 'open' | 'applied' | 'dismissed'
  applied_at: string | null
  pr_url: string | null
  estimated_upside_clicks: number | null
}

const ChangeListSchema = z.object({
  title: z.object({ proposed: z.string().min(1) }),
  meta_description: z.object({ proposed: z.string().min(1) }),
  sections_to_add: z.array(z.object({ heading: z.string(), covers: z.string(), position_hint: z.string() })),
  internal_links_to_add: z.array(z.object({ from_url: z.string(), anchor: z.string() })),
  remove_or_merge: z.array(z.object({ what: z.string(), why: z.string() })),
})

const CHANGE_LIST_SYSTEM = `You are an SEO editor producing a concrete change list to refresh ONE existing page so it ranks higher for the queries it already earns impressions for.

You are given: the page URL, its current title, meta description and heading outline, the queries it ranks for (with position and impressions), the heading outlines of the top-ranking competitor pages, headings common to competitors but missing here, unanswered People Also Ask questions, and a list of the site's other published URLs (for internal links).

Rules:
- title.proposed: 50-60 characters, leads with the primary query's meaning, no clickbait.
- meta_description.proposed: 140-155 characters, states the answer, includes the primary query naturally.
- sections_to_add: ordered, each with the heading text, one sentence on what it must cover, and where it goes relative to existing headings.
- internal_links_to_add: ONLY from_url values in the provided published-URLs list, pointing AT this page. Never invent a URL. Empty list if none provided.
- remove_or_merge: existing sections that are thin, duplicated or off-intent. Empty if none.
- Never output a search volume, difficulty or traffic figure.
- British English. No em dashes.

Return strict JSON only — no preamble, no code fences:
{ "title": { "proposed": string }, "meta_description": { "proposed": string }, "sections_to_add": [ { "heading": string, "covers": string, "position_hint": string } ], "internal_links_to_add": [ { "from_url": string, "anchor": string } ], "remove_or_merge": [ { "what": string, "why": string } ] }`

function normaliseHeading(h: string): string {
  return h.replace(/^H[1-6]:\s*/i, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

/** Headings that appear on ≥ `minCount` competitor outlines and are absent here. */
export function headingGap(page: PageOutline | null, winners: CompetitorOutline[], minCount = 3): string[] {
  const ours = new Set((page?.headings ?? []).map(normaliseHeading))
  for (const h of page?.h1 ?? []) ours.add(normaliseHeading(h))
  const counts = new Map<string, { count: number; display: string }>()
  for (const w of winners) {
    const seen = new Set<string>()
    for (const h of w.headings) {
      const key = normaliseHeading(h)
      if (!key || key.length < 4 || seen.has(key)) continue
      seen.add(key)
      const entry = counts.get(key) ?? { count: 0, display: h.replace(/^H[1-6]:\s*/i, '') }
      entry.count += 1
      counts.set(key, entry)
    }
  }
  return [...counts.entries()]
    .filter(([key, v]) => v.count >= minCount && !ours.has(key) && ![...ours].some((o) => o.includes(key) || key.includes(o)))
    .sort((a, b) => b[1].count - a[1].count)
    .map(([, v]) => v.display)
    .slice(0, 12)
}

function questionAnswered(question: string, page: PageOutline | null): boolean {
  if (!page) return false
  const q = normaliseHeading(question)
  const words = q.split(' ').filter((w) => w.length > 3)
  if (words.length === 0) return false
  const haystack = [...page.headings, ...page.h1].map(normaliseHeading).join(' | ')
  const hits = words.filter((w) => haystack.includes(w)).length
  return hits / words.length >= 0.6
}

export async function getWorksheet(siteId: string, url: string): Promise<RefreshWorksheet | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('seo_page_refreshes')
    .select('*')
    .eq('site_id', siteId)
    .eq('url', url)
    .maybeSingle()
  return (data as RefreshWorksheet | null) ?? null
}

/** Build (or rebuild) the worksheet for a URL. Returns the stored row. */
export async function generateWorksheet(site: SeoSite, url: string): Promise<RefreshWorksheet> {
  const supabase = createClient()
  const stats = await pageStats(site.id, url)

  const primary = stats.opportunities[0]?.query ?? stats.queries[0]?.query ?? null

  // Snapshot for the primary query — parsed state carries the top URLs and PAA.
  let snapshotStatus: RefreshPayload['serp_snapshot_status'] = 'none'
  let topUrls: string[] = []
  let paa: string[] = []
  if (primary) {
    const { data: kw } = await supabase
      .from('seo_keywords')
      .select('id, keyword')
      .eq('site_id', site.id)
      .eq('keyword', primary)
      .maybeSingle()
    if (kw) {
      const { data: state } = await supabase
        .from('seo_serp_state')
        .select('top_urls, paa_questions')
        .eq('keyword_id', kw.id as string)
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (state) {
        snapshotStatus = 'ready'
        topUrls = (state.top_urls as string[]) ?? []
        paa = (state.paa_questions as string[]) ?? []
      } else {
        try {
          await requestSerpSnapshots([{ id: kw.id as string, keyword: kw.keyword as string }])
          snapshotStatus = 'queued'
        } catch {
          snapshotStatus = 'none'
        }
      }
    }
  }

  const siteHost = site.domain.toLowerCase().replace(/^www\./, '')
  const competitorUrls = topUrls
    .filter((u) => {
      try {
        return new URL(u).hostname.replace(/^www\./, '') !== siteHost
      } catch {
        return false
      }
    })
    .slice(0, 5)

  const [page, ...competitorOutlines] = await Promise.all([
    fetchPageOutline(url),
    ...competitorUrls.map((u) => fetchPageOutline(u)),
  ])
  const winners: CompetitorOutline[] = competitorOutlines
    .filter((o): o is PageOutline => Boolean(o))
    .map((o) => ({ url: o.url, title: o.title, headings: [...o.h1.map((h) => `H1: ${h}`), ...o.headings] }))

  const gapHeadings = headingGap(page, winners)
  const unanswered = paa.filter((q) => !questionAnswered(q, page)).slice(0, 8)

  // E2.6: Quality Score landing-page component as a second opinion on this URL.
  let qualityNote: string | null = null
  const { data: adsKw } = await supabase
    .from('ads_keywords')
    .select('keyword, quality_score, qs_landing_page, ads_accounts!inner(site_id)')
    .eq('ads_accounts.site_id', site.id)
    .eq('landing_page', url)
    .eq('qs_landing_page', 'BELOW_AVERAGE')
    .limit(3)
  if (adsKw && adsKw.length > 0) {
    qualityNote = `Google Ads rates this landing page BELOW AVERAGE for ${adsKw.length} paid keyword${adsKw.length === 1 ? '' : 's'} (${adsKw.map((k) => `"${k.keyword}"${k.quality_score ? ` QS ${k.quality_score}` : ''}`).join(', ')}). Two independent signals agree this page underperforms.`
  }

  const { data: published } = await supabase
    .from('seo_articles')
    .select('published_url')
    .eq('site_id', site.id)
    .eq('status', 'published')
    .not('published_url', 'is', null)
  const publishedUrls = (published ?? []).map((a) => a.published_url as string).filter((u) => u !== url)

  const changeList = await buildChangeList({
    url,
    page,
    queries: stats.queries.slice(0, 25),
    winners,
    gapHeadings,
    unanswered,
    publishedUrls,
  })

  const payload: RefreshPayload = {
    url,
    primary_query: primary,
    stats,
    page,
    winners,
    gap_headings: gapHeadings,
    unanswered_questions: unanswered,
    serp_snapshot_status: snapshotStatus,
    quality_score_note: qualityNote,
    change_list: changeList,
    ctr_model_label: CTR_MODEL_LABEL,
  }

  const { data: row, error } = await supabase
    .from('seo_page_refreshes')
    .upsert(
      {
        site_id: site.id,
        url,
        generated_at: new Date().toISOString(),
        payload,
        status: 'open',
        estimated_upside_clicks: stats.estimatedUpside,
      },
      { onConflict: 'site_id,url' }
    )
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return row as RefreshWorksheet
}

async function buildChangeList(input: {
  url: string
  page: PageOutline | null
  queries: PageStats['queries']
  winners: CompetitorOutline[]
  gapHeadings: string[]
  unanswered: string[]
  publishedUrls: string[]
}): Promise<RefreshChangeList | null> {
  const payload = {
    url: input.url,
    current: input.page
      ? { title: input.page.title, meta_description: input.page.meta_description, h1: input.page.h1, headings: input.page.headings }
      : null,
    queries: input.queries.map((q) => ({ query: q.query, position: q.position, impressions: q.impressions })),
    competitor_outlines: input.winners,
    headings_competitors_have_that_we_lack: input.gapHeadings,
    unanswered_questions: input.unanswered,
    published_urls_for_internal_links: input.publishedUrls,
  }

  let reason = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    const system = attempt === 0 ? CHANGE_LIST_SYSTEM : `${CHANGE_LIST_SYSTEM}\n\nYour previous response was rejected: ${reason}. Return ONLY valid JSON for the schema.`
    let response
    try {
      response = await anthropic.messages.create({
        model: ANTHROPIC_MODELS.OPUS,
        max_tokens: 6000,
        system,
        messages: [{ role: 'user', content: JSON.stringify(payload) }],
      })
    } catch (err) {
      reason = err instanceof Error ? err.message : 'model call failed'
      continue
    }
    try {
      const parsed = ChangeListSchema.safeParse(JSON.parse(stripFences(textOf(response))))
      if (!parsed.success) {
        reason = 'the response was not valid JSON for the schema'
        continue
      }
      const allowed = new Set(input.publishedUrls)
      return {
        title: { current: input.page?.title ?? null, proposed: parsed.data.title.proposed, length: parsed.data.title.proposed.length },
        meta_description: {
          current: input.page?.meta_description ?? null,
          proposed: parsed.data.meta_description.proposed,
          length: parsed.data.meta_description.proposed.length,
        },
        sections_to_add: parsed.data.sections_to_add,
        internal_links_to_add: parsed.data.internal_links_to_add.filter((l) => allowed.has(l.from_url)),
        remove_or_merge: parsed.data.remove_or_merge,
      }
    } catch {
      reason = 'the response was not valid JSON'
    }
  }
  return null
}

/** Persist a checkbox toggle on the worksheet. */
export async function setWorksheetCheck(siteId: string, url: string, key: string, checked: boolean): Promise<void> {
  const supabase = createClient()
  const existing = await getWorksheet(siteId, url)
  if (!existing) return
  const next = { ...existing.checked, [key]: checked }
  await supabase.from('seo_page_refreshes').update({ checked: next }).eq('id', existing.id)
}

export async function setWorksheetStatus(
  siteId: string,
  url: string,
  status: 'open' | 'applied' | 'dismissed',
  prUrl?: string
): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('seo_page_refreshes')
    .update({
      status,
      applied_at: status === 'applied' ? new Date().toISOString() : null,
      ...(prUrl ? { pr_url: prUrl } : {}),
    })
    .eq('site_id', siteId)
    .eq('url', url)
}

/** Stable keys for the checkboxes so `checked` survives regeneration. */
export function changeItemKeys(list: RefreshChangeList): Array<{ key: string; label: string; group: string }> {
  const out: Array<{ key: string; label: string; group: string }> = [
    { key: 'title', label: `Title → "${list.title.proposed}" (${list.title.length} chars)`, group: 'Head' },
    { key: 'meta', label: `Meta description → "${list.meta_description.proposed}" (${list.meta_description.length} chars)`, group: 'Head' },
  ]
  list.sections_to_add.forEach((s, i) =>
    out.push({ key: `section:${i}`, label: `Add "${s.heading}" — ${s.covers} (${s.position_hint})`, group: 'Sections to add' })
  )
  list.internal_links_to_add.forEach((l, i) =>
    out.push({ key: `link:${i}`, label: `Link from ${l.from_url} with anchor "${l.anchor}"`, group: 'Internal links to add' })
  )
  list.remove_or_merge.forEach((r, i) =>
    out.push({ key: `remove:${i}`, label: `${r.what} — ${r.why}`, group: 'Remove or merge' })
  )
  return out
}

export function encodePageUrl(url: string): string {
  return Buffer.from(url, 'utf8').toString('base64url')
}

export function decodePageUrl(encoded: string): string {
  return Buffer.from(encoded, 'base64url').toString('utf8')
}

export function worksheetPath(siteId: string, url: string): string {
  return `/growth/${siteId}/pages/${encodePageUrl(url)}`
}
