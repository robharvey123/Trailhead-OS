import { createClient } from '@/lib/supabase/service'
import { dataForSeoConfigured, getBacklinksSummary } from '@/lib/growth/dataforseo'
import { technicalScoreInput } from '@/lib/growth/onpage'
import type { SeoSite } from '@/lib/types'

/**
 * Growth Score (nightly). An honest weighted composite, never a vanity number:
 * every component stores its raw value and one-line explanation in the
 * breakdown, and components with no data yet are EXCLUDED and the remaining
 * weights renormalised — a new site scores against what's measurable, not
 * padded with zeros or fake credit.
 *
 * Components (brief-defined): published vs planned pages, referring domains,
 * keywords in the Google top 10, AI mention rate, % of published articles
 * distributed. Computed once per day by the growth-score cron and stored in
 * seo_growth_scores so the header number has history and costs nothing to render.
 */

export interface ScoreComponent {
  key: string
  label: string
  /** 0-1 progress toward the component's target, or null when no data exists yet. */
  value: number | null
  weight: number
  detail: string
  /** D5: what would raise this component, and where to do it. */
  raise?: string
  href?: string
}

export interface GrowthScoreBreakdown {
  components: ScoreComponent[]
  summary: string
}

const TOP10_TARGET = 10
const REFERRING_DOMAINS_TARGET = 20
/** Weighted open technical issues at which the technical component hits zero. */
const ISSUE_TARGET = 40

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export async function computeSiteScore(
  site: SeoSite
): Promise<{ score: number; breakdown: GrowthScoreBreakdown }> {
  const supabase = createClient()

  const [keywordsRes, briefsRes, articlesRes, mentionsRes] = await Promise.all([
    supabase.from('seo_keywords').select('gsc_position').eq('site_id', site.id),
    supabase.from('seo_briefs').select('status').eq('site_id', site.id),
    supabase.from('seo_articles').select('status').eq('site_id', site.id),
    supabase
      .from('seo_ai_mentions')
      .select('brand_mentioned')
      .eq('site_id', site.id)
      .gte('run_at', new Date(Date.now() - 28 * 86400_000).toISOString()),
  ])

  const keywords = keywordsRes.data ?? []
  const briefs = briefsRes.data ?? []
  const articles = articlesRes.data ?? []
  const mentions = mentionsRes.data ?? []

  // Refresh the referring-domain cache (one Live call per site per night).
  let referringDomains = site.referring_domains
  if (dataForSeoConfigured()) {
    try {
      const summary = await getBacklinksSummary(site.domain)
      referringDomains = summary.referring_domains
      await supabase
        .from('seo_sites')
        .update({
          referring_domains: summary.referring_domains,
          referring_domains_checked_at: new Date().toISOString(),
        })
        .eq('id', site.id)
    } catch {
      /* keep the cached value — a failed backlinks call must not sink the score run */
    }
  }

  const tracked = keywords.filter((k) => k.gsc_position !== null).length
  const top10 = keywords.filter((k) => k.gsc_position !== null && k.gsc_position <= 10).length
  const published = articles.filter((a) => a.status === 'published').length
  const planned = published + articles.filter((a) => a.status !== 'archived' && a.status !== 'published').length
    + briefs.filter((b) => b.status === 'approved').length
  const aiRuns = mentions.length
  const aiHits = mentions.filter((m) => m.brand_mentioned).length
  const technical = await technicalScoreInput(site.id, supabase).catch(() => null)
  const quickWins = keywords.filter((k) => k.gsc_position !== null && k.gsc_position >= 11 && k.gsc_position <= 20).length
  const base = `/growth/${site.id}`

  const components: ScoreComponent[] = [
    {
      key: 'top10',
      label: 'Keywords in top 10',
      value: tracked > 0 ? clamp01(top10 / TOP10_TARGET) : null,
      weight: 0.3,
      detail:
        tracked > 0
          ? `${top10} of ${tracked} tracked keywords rank in Google's top 10 (target ${TOP10_TARGET})`
          : 'No ranking data yet — sync Search Console',
      raise: quickWins > 0
        ? `${quickWins} keyword${quickWins === 1 ? '' : 's'} sit at 11-20 — each refresh that lands on page one adds a point here`
        : 'Publish against approved briefs; new pages take 6-12 weeks to settle',
      href: quickWins > 0 ? `${base}/keywords?band=11-20` : `${base}/briefs`,
    },
    {
      key: 'referring_domains',
      label: 'Referring domains',
      value: referringDomains !== null ? clamp01(referringDomains / REFERRING_DOMAINS_TARGET) : null,
      weight: 0.25,
      detail:
        referringDomains !== null
          ? `${referringDomains} referring domains (target ${REFERRING_DOMAINS_TARGET})`
          : 'Not checked yet — needs DataForSEO credentials',
      raise: 'Every link won on the Links page is one more referring domain',
      href: `${base}/links`,
    },
    {
      key: 'content',
      label: 'Published vs planned pages',
      value: planned > 0 ? clamp01(published / planned) : null,
      weight: 0.2,
      detail:
        planned > 0
          ? `${published} of ${planned} planned articles published`
          : 'No content planned yet',
      raise: 'Approve drafts in review and publish approved articles',
      href: `${base}/articles`,
    },
    {
      key: 'ai_mentions',
      label: 'AI mention rate',
      value: aiRuns > 0 ? clamp01(aiHits / aiRuns) : null,
      weight: 0.15,
      detail:
        aiRuns > 0
          ? `Mentioned in ${aiHits} of ${aiRuns} AI answers over 28 days`
          : 'AI visibility tracking not running yet',
      raise: 'AI engines cite the pages that rank and the domains that get linked — content and links move this, prompts only measure it',
      href: `${base}/prompts`,
    },
    {
      key: 'distribution',
      label: 'Published articles distributed',
      // Wired up in Phase 5 when distribution tasks exist; excluded until then.
      value: null,
      weight: 0.1,
      detail: 'Distribution tracking starts with the outreach phase',
    },
    {
      key: 'technical',
      label: 'Technical health',
      value: technical ? 1 - clamp01(technical.weighted / ISSUE_TARGET) : null,
      weight: 0.15,
      detail: technical
        ? `${technical.open} open issue${technical.open === 1 ? '' : 's'} (${technical.critical} critical) from the last crawl`
        : 'No crawl yet — the first OnPage crawl runs on the next growth-crawl tick',
      raise: technical && technical.open > 0 ? 'Fix the critical and high issues first; the next crawl resolves them automatically' : 'Keep the crawl clean',
      href: `${base}/keywords?issues=1`,
    },
  ]

  const active = components.filter((c) => c.value !== null)
  const totalWeight = active.reduce((sum, c) => sum + c.weight, 0)
  const score =
    totalWeight > 0
      ? Math.round((active.reduce((sum, c) => sum + c.weight * (c.value as number), 0) / totalWeight) * 100)
      : 0

  const summary =
    active.length > 0
      ? `${score}/100 from ${active.map((c) => c.label.toLowerCase()).join(', ')} — components without data are excluded, not zeroed.`
      : 'No measurable signals yet — sync Search Console or queue keyword research to start scoring.'

  return { score, breakdown: { components, summary } }
}

export async function runGrowthScores(): Promise<{
  scored: Array<{ site: string; score: number }>
  errors: Array<{ site: string; error: string }>
}> {
  const supabase = createClient()
  const { data: sites, error } = await supabase.from('seo_sites').select('*')
  if (error) throw new Error(error.message)

  const today = new Date().toISOString().slice(0, 10)
  const scored: Array<{ site: string; score: number }> = []
  const errors: Array<{ site: string; error: string }> = []

  for (const site of (sites ?? []) as SeoSite[]) {
    try {
      const { score, breakdown } = await computeSiteScore(site)
      const { error: upsertError } = await supabase
        .from('seo_growth_scores')
        .upsert(
          { site_id: site.id, score_date: today, score, breakdown },
          { onConflict: 'site_id,score_date' }
        )
      if (upsertError) throw new Error(upsertError.message)
      scored.push({ site: site.domain, score })
    } catch (err) {
      errors.push({ site: site.domain, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return { scored, errors }
}
