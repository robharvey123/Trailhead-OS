import { createClient } from '@/lib/supabase/service'
import { anthropic, ANTHROPIC_MODELS } from '@/lib/anthropic/client'
import { getCompetitorBacklinks, dataForSeoConfigured } from '@/lib/growth/dataforseo'
import { peakMonth, weeksUntilMonth } from '@/lib/growth/enrich'
import { estimatedMonthlyUpside } from '@/lib/growth/ctr'
import { notifyLinkWon } from '@/lib/growth/links'
import { cannibalisedQueries, decayingPages, hasQueryPageHistory, WINDOW_DAYS } from '@/lib/growth/pages'
import {
  coverGapKeywords,
  fatiguedCreatives,
  groupWastedTerms,
  handoffOpportunities,
  pacing,
  paidOnOwnedKeywords,
  trackingHealth,
  wastedSearchTerms,
} from '@/lib/growth/paid-loops'
import { worksheetPath } from '@/lib/growth/refresh'
import { createEngineTaskOnce } from '@/lib/growth/tasks'
import type { SeoSite } from '@/lib/types'

/**
 * Nightly engine → task generation (growth-tasks cron). Every rule is
 * idempotent: follow-ups flip a once-only flag, everything else dedupes on an
 * identical open task title via createEngineTaskOnce.
 *
 * D4 rule, applied to every generator: the task names its object, shows the
 * evidence with its window, states the expected gain (labelled as an
 * estimate where it is one) and offers the first click.
 */

const QUICK_WIN_LIMIT = 3
const AI_COMPETITOR_THRESHOLD = 3
const TECHNICAL_TASK_CAP = 5
const GAP_TASK_MIN_KEYWORDS = 5

export interface TaskGenResult {
  followups: number
  quickWins: number
  noPageTargets: number
  decay: number
  cannibalisation: number
  backlinkMining: number
  factChecks: number
  reportReviews: number
  repliesClassified: number
  linksWonDetected: number
  gap: number
  technical: number
  seasonal: number
  paid: number
  errors: string[]
}

export async function generateEngineTasks(): Promise<TaskGenResult> {
  const supabase = createClient()
  const result: TaskGenResult = {
    followups: 0,
    quickWins: 0,
    noPageTargets: 0,
    decay: 0,
    cannibalisation: 0,
    backlinkMining: 0,
    factChecks: 0,
    reportReviews: 0,
    repliesClassified: 0,
    linksWonDetected: 0,
    gap: 0,
    technical: 0,
    seasonal: 0,
    paid: 0,
    errors: [],
  }

  const { data: sites, error } = await supabase.from('seo_sites').select('*')
  if (error) throw new Error(error.message)

  for (const site of (sites ?? []) as SeoSite[]) {
    const steps: Array<[string, () => Promise<void>]> = [
      ['followups', () => followupTasks(site, result)],
      ['quickWins', () => quickWinTasks(site, result)],
      ['decay', () => decayTasks(site, result)],
      ['cannibalisation', () => cannibalisationTasks(site, result)],
      ['backlinkMining', () => backlinkMiningTasks(site, result)],
      ['factChecks', () => factCheckTasks(site, result)],
      ['monthlyReport', () => monthlyReportTask(site, result)],
      ['replies', () => classifyOutreachReplies(site, result)],
      ['wonLinks', () => detectWonLinks(site, result)],
      ['gap', () => gapTask(site, result)],
      ['technical', () => technicalTasks(site, result)],
      ['seasonal', () => seasonalTasks(site, result)],
      ['paid', () => paidTasks(site, result)],
    ]
    for (const [name, step] of steps) {
      try {
        await step()
      } catch (err) {
        result.errors.push(`${site.domain} ${name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }
  return result
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname || url
  } catch {
    return url
  }
}

/** Outreach follow-up at 7 days — once only, never twice (followup_created flag). */
async function followupTasks(site: SeoSite, result: TaskGenResult): Promise<void> {
  const supabase = createClient()
  const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString()
  const { data: due } = await supabase
    .from('seo_link_targets')
    .select('id, url, angle, outreach_at, accounts:crm_account_id(name)')
    .eq('site_id', site.id)
    .eq('status', 'outreach')
    .eq('followup_created', false)
    .is('recipient_id', null) // engine-queued targets get the engine's step-2 follow-up
    .lt('outreach_at', cutoff)

  for (const target of due ?? []) {
    const account = (target.accounts as unknown as { name: string } | null)?.name ?? target.url
    await createEngineTaskOnce({
      title: `Follow up outreach: ${account}`,
      url: target.url,
      context: {
        what: `One follow-up on the link pitch for ${site.domain}.`,
        why: `Pitched ${target.outreach_at ? new Date(target.outreach_at as string).toLocaleDateString('en-GB') : '7+ days ago'} with no reply; a single follow-up lifts reply rates without burning the contact.`,
        evidence: [`Angle: ${target.angle ?? '—'}`],
        firstStep: 'Open the Gmail thread and reply on it (do not start a new thread).',
        link: `/growth/${site.id}/links`,
      },
      dueDate: today(),
      extraLabels: ['outreach'],
    })
    await supabase.from('seo_link_targets').update({ followup_created: true }).eq('id', target.id)
    result.followups += 1
  }
}

/** Keywords parked at position 11-20 are the cheapest wins — refresh THE PAGE,
 *  named. Where no page owns the query that is itself the finding. */
async function quickWinTasks(site: SeoSite, result: TaskGenResult): Promise<void> {
  const supabase = createClient()
  const { data: winners } = await supabase
    .from('seo_keywords')
    .select('keyword, gsc_position, gsc_impressions, ranking_url, ranking_url_position, ranking_url_impressions, ranking_url_checked_at')
    .eq('site_id', site.id)
    .gte('gsc_position', 11)
    .lte('gsc_position', 20)
    .order('gsc_impressions', { ascending: false, nullsFirst: false })
    .limit(QUICK_WIN_LIMIT * 4)

  // Group by page so one task covers every quick-win query that page holds.
  const byPage = new Map<string, Array<{ keyword: string; position: number; impressions: number }>>()
  const noPage: Array<{ keyword: string; position: number; impressions: number }> = []
  for (const k of winners ?? []) {
    const entry = { keyword: k.keyword as string, position: Number(k.gsc_position), impressions: Number(k.gsc_impressions ?? 0) }
    if (k.ranking_url) byPage.set(k.ranking_url as string, [...(byPage.get(k.ranking_url as string) ?? []), entry])
    else if (k.ranking_url_checked_at) noPage.push(entry)
  }

  let created = 0
  for (const [url, queries] of [...byPage.entries()].sort((a, b) => b[1].reduce((s, q) => s + q.impressions, 0) - a[1].reduce((s, q) => s + q.impressions, 0))) {
    if (created >= QUICK_WIN_LIMIT) break
    const upside = queries.reduce((s, q) => s + estimatedMonthlyUpside(q.impressions, q.position, 90), 0)
    const ok = await createEngineTaskOnce({
      title: `On-page refresh: ${pathOf(url)} (${site.domain})`,
      url,
      context: {
        what: `This page sits on page two for ${queries.length} quer${queries.length === 1 ? 'y' : 'ies'} it already ranks for.`,
        why: 'Positions 11-20 are the cheapest wins in the module: the page is indexed and relevant, it needs a better answer, not a new one.',
        evidence: queries.slice(0, 5).map((q) => `Ranks ${q.position} for "${q.keyword}" (${q.impressions.toLocaleString('en-GB')} impressions, 90d)`),
        gain: `roughly ${upside} extra clicks per month at position 3 (CTR-curve estimate)`,
        firstStep: 'Open the refresh worksheet: it shows what the top-ranking pages cover that this one does not, and drafts the change list.',
        link: worksheetPath(site.id, url),
      },
      priority: upside >= 100 ? 'high' : 'normal',
      extraLabels: ['on-page'],
    })
    if (ok) {
      created += 1
      result.quickWins += 1
    }
  }

  if (noPage.length >= 3) {
    const ok = await createEngineTaskOnce({
      title: `No page targets ${noPage.length} page-two queries (${site.domain})`,
      context: {
        what: `${noPage.length} queries earn impressions at positions 11-20 but no single page owns them in Search Console.`,
        why: 'Impressions with no owning page mean Google is matching a weak page or several weak pages: a new, deliberate page usually wins these faster than a refresh.',
        evidence: noPage.slice(0, 6).map((q) => `"${q.keyword}" — position ${q.position}, ${q.impressions.toLocaleString('en-GB')} impressions (90d)`),
        firstStep: 'Send them to clustering or draft a brief from the keyword page.',
        link: `/growth/${site.id}/keywords?target=none`,
      },
      extraLabels: ['content'],
    })
    if (ok) result.noPageTargets += 1
  }
}

/** C2: content decay — evidence-based, replaces the blanket 30-day fact-check. */
async function decayTasks(site: SeoSite, result: TaskGenResult): Promise<void> {
  if (!(await hasQueryPageHistory(site.id))) return
  const decaying = await decayingPages(site.id)
  for (const page of decaying.slice(0, 5)) {
    const ok = await createEngineTaskOnce({
      title: `Refresh (decay): ${pathOf(page.url)} (${site.domain})`,
      url: page.url,
      context: {
        what: `Clicks fell ${page.dropPct}% against the same window three months ago.`,
        why: `${page.clicksThen.toLocaleString('en-GB')} clicks in the ${WINDOW_DAYS} days ending 90 days ago → ${page.clicksNow.toLocaleString('en-GB')} in the last ${WINDOW_DAYS}. Decay on an established page is the highest-ROI content work there is.`,
        evidence: page.losingQueries.map((q) => `"${q.query}" impressions ${q.impressionsThen.toLocaleString('en-GB')} → ${q.impressionsNow.toLocaleString('en-GB')}`),
        gain: `recovering the lost ${(page.clicksThen - page.clicksNow).toLocaleString('en-GB')} clicks per ${WINDOW_DAYS} days`,
        firstStep: 'Open the worksheet, check what the current top results cover, update facts and dates, then republish.',
        link: worksheetPath(site.id, page.url),
      },
      priority: page.clicksThen - page.clicksNow >= 100 ? 'high' : 'normal',
      extraLabels: ['content', 'decay'],
    })
    if (ok) result.decay += 1
  }
}

/** C2: cannibalisation — two pages splitting one query. */
async function cannibalisationTasks(site: SeoSite, result: TaskGenResult): Promise<void> {
  if (!(await hasQueryPageHistory(site.id))) return
  const clashes = await cannibalisedQueries(site.id)
  for (const c of clashes.slice(0, 5)) {
    const ok = await createEngineTaskOnce({
      title: `Resolve cannibalisation: "${c.query}" (${site.domain})`,
      context: {
        what: `${c.pages.length} pages each hold a meaningful share of this query's impressions, so neither ranks as well as one would.`,
        why: `${c.impressions.toLocaleString('en-GB')} impressions over ${WINDOW_DAYS} days split across pages; consolidating usually lifts the survivor several positions.`,
        evidence: c.pages.map((p) => `${p.url} — ${Math.round(p.share * 100)}% of impressions, ${p.clicks} clicks, position ${p.position ?? '—'}`),
        firstStep: 'Pick the page that should own the query, fold the other into it (or point its internal links and canonical at the winner).',
        link: `/growth/${site.id}/keywords?q=${encodeURIComponent(c.query)}`,
      },
      extraLabels: ['content', 'cannibalisation'],
    })
    if (ok) result.cannibalisation += 1
  }
}

/** A competitor the AI engines keep naming instead of us is a backlink-gap lead. */
async function backlinkMiningTasks(site: SeoSite, result: TaskGenResult): Promise<void> {
  const supabase = createClient()
  const since = new Date(Date.now() - 28 * 86400_000).toISOString()
  const { data: mentions } = await supabase
    .from('seo_ai_mentions')
    .select('competitors_mentioned')
    .eq('site_id', site.id)
    .gte('run_at', since)

  const counts = new Map<string, number>()
  for (const m of mentions ?? []) {
    for (const c of (m.competitors_mentioned as string[]) ?? []) {
      counts.set(c, (counts.get(c) ?? 0) + 1)
    }
  }
  for (const [competitor, count] of counts) {
    if (count <= AI_COMPETITOR_THRESHOLD) continue
    const created = await createEngineTaskOnce({
      title: `Mine backlinks: ${competitor} (${site.domain})`,
      context: {
        what: `${competitor} keeps being recommended by the AI engines where ${site.name} is not.`,
        why: `Named ${count}× in AI answers over 28 days (threshold ${AI_COMPETITOR_THRESHOLD}). AI engines lean on the same authority signals as Google: their referring domains are a ready-made prospect list.`,
        firstStep: `On the Links page, run prospect import on "${competitor}" and work the gap.`,
        link: `/growth/${site.id}/links`,
      },
      extraLabels: ['outreach'],
    })
    if (created) result.backlinkMining += 1
  }
}

/** Fact-check each article ~30 days after publishing — only where there is
 *  no decay evidence yet (decay tasks supersede this once history exists). */
async function factCheckTasks(site: SeoSite, result: TaskGenResult): Promise<void> {
  const supabase = createClient()
  const from = new Date(Date.now() - 31 * 86400_000).toISOString()
  const to = new Date(Date.now() - 30 * 86400_000).toISOString()
  const { data: articles } = await supabase
    .from('seo_articles')
    .select('title, published_url')
    .eq('site_id', site.id)
    .eq('status', 'published')
    .gte('published_at', from)
    .lt('published_at', to)

  for (const article of articles ?? []) {
    const created = await createEngineTaskOnce({
      title: `Fact-check: ${article.title}`,
      url: article.published_url ?? undefined,
      context: {
        what: 'Re-verify every claim, price and source in this article.',
        why: 'Published 30 days ago. Model-drafted articles cite sources at draft time; prices and competitor claims drift within a month.',
        firstStep: 'Open each source link in the article and confirm it still says what the article says.',
        link: `/growth/${site.id}/articles`,
      },
      extraLabels: ['content'],
    })
    if (created) result.factChecks += 1
  }
}

/** First of the month: review & send the client report. */
async function monthlyReportTask(site: SeoSite, result: TaskGenResult): Promise<void> {
  if (new Date().getUTCDate() !== 1) return
  const month = new Date().toISOString().slice(0, 7)
  const created = await createEngineTaskOnce({
    title: `Send monthly SEO report: ${site.name} (${month})`,
    context: {
      what: 'Generate, review and send last month’s report.',
      firstStep: `Generate at /api/growth/report/${site.id}, review it, then send via Gmail${site.is_client ? ' to the client (logged against their CRM account)' : ''}.`,
      link: `/api/growth/report/${site.id}`,
    },
    dueDate: today(),
    priority: 'high',
    extraLabels: ['reporting'],
  })
  if (created) result.reportReviews += 1
}

/** B2: the competitor gap, weekly, capped so it does not nag. */
async function gapTask(site: SeoSite, result: TaskGenResult): Promise<void> {
  if (new Date().getUTCDay() !== 1) return // Mondays
  const { gapKeywords } = await import('@/lib/growth/competitors')
  const gap = (await gapKeywords(site.id)).filter((g) => !g.in_keyword_list)
  if (gap.length < GAP_TASK_MIN_KEYWORDS) return
  const etv = Math.round(gap.reduce((s, g) => s + g.etv, 0))
  const week = new Date().toISOString().slice(0, 10)
  const ok = await createEngineTaskOnce({
    title: `Competitor gap: ${gap.length} keywords uncovered (${site.domain}, w/c ${week})`,
    context: {
      what: `${gap.length} keywords where a tracked competitor ranks top-20 and ${site.name} does not.`,
      why: `Combined estimated traffic value ${etv.toLocaleString('en-GB')} (DataForSEO ETV). ${gap.filter((g) => g.competitors.length >= 2).length} of them are owned by two or more competitors — the strongest signal of a topic worth having.`,
      evidence: gap.slice(0, 6).map((g) => `"${g.keyword}" — ${g.competitors.length} competitor${g.competitors.length === 1 ? '' : 's'}, volume ${g.search_volume ?? '—'}, KD ${g.keyword_difficulty ?? '—'}`),
      firstStep: 'Open the gap view, filter by KD ceiling, add the keepers to the keyword list and send them to clustering.',
      link: `/growth/${site.id}/gap`,
    },
    extraLabels: ['research'],
  })
  if (ok) result.gap += 1
}

/** C1: open critical/high issues become tasks, capped at 5 by severity. */
async function technicalTasks(site: SeoSite, result: TaskGenResult): Promise<void> {
  const supabase = createClient()
  const { data: issues } = await supabase
    .from('seo_page_issues')
    .select('url, issue_type, severity, detail')
    .eq('site_id', site.id)
    .is('resolved_at', null)
    .in('severity', ['critical', 'high'])
    .order('severity', { ascending: true }) // 'critical' < 'high' alphabetically
    .limit(TECHNICAL_TASK_CAP)
  for (const issue of issues ?? []) {
    const ok = await createEngineTaskOnce({
      title: `Fix ${String(issue.issue_type).replace(/_/g, ' ')}: ${pathOf(issue.url as string)} (${site.domain})`,
      url: issue.url as string,
      context: {
        what: issue.detail as string,
        why: `Severity ${issue.severity}, found by the monthly crawl. Technical issues cap what any content work can achieve on this page.`,
        firstStep: 'Fix in the site repo or CMS; the next crawl marks it resolved automatically.',
        link: `/growth/${site.id}/keywords?issues=1`,
      },
      priority: issue.severity === 'critical' ? 'high' : 'normal',
      extraLabels: ['technical'],
    })
    if (ok) result.technical += 1
  }
}

/** B3: surface a cluster 10-12 weeks before its seasonal peak. */
async function seasonalTasks(site: SeoSite, result: TaskGenResult): Promise<void> {
  const supabase = createClient()
  const { data: clusters } = await supabase
    .from('seo_clusters')
    .select('id, name, pillar_keyword')
    .eq('site_id', site.id)
    .in('status', ['proposed', 'approved'])
  for (const cluster of clusters ?? []) {
    const { data: members } = await supabase.from('seo_keywords').select('id').eq('cluster_id', cluster.id).limit(50)
    const ids = (members ?? []).map((m) => m.id as string)
    if (ids.length === 0) continue
    const { data: history } = await supabase.from('seo_keyword_volume_monthly').select('month, search_volume').in('keyword_id', ids)
    const peak = peakMonth((history ?? []) as Array<{ month: number; search_volume: number }>)
    if (!peak) continue
    const weeks = weeksUntilMonth(peak)
    if (weeks < 10 || weeks > 12) continue
    const monthName = new Date(Date.UTC(2000, peak - 1, 1)).toLocaleString('en-GB', { month: 'long' })
    const ok = await createEngineTaskOnce({
      title: `Seasonal: prepare "${cluster.name}" before ${monthName} (${site.domain})`,
      context: {
        what: `Search demand for this cluster peaks in ${monthName}, ${weeks} weeks away.`,
        why: 'Content needs roughly 10-12 weeks to be indexed and aged before demand arrives; publishing at the peak misses it.',
        firstStep: 'Generate and approve briefs for the cluster now so drafts are live inside a month.',
        link: `/growth/${site.id}/clusters`,
      },
      priority: 'high',
      extraLabels: ['content', 'seasonal'],
    })
    if (ok) result.seasonal += 1
  }
}

/** E5: paid tasks — pacing, waste, self-cannibalisation, fatigue, tracking health, handoffs. */
async function paidTasks(site: SeoSite, result: TaskGenResult): Promise<void> {
  const supabase = createClient()
  const { count } = await supabase.from('ads_accounts').select('id', { count: 'exact', head: true }).eq('site_id', site.id).eq('status', 'active')
  if (!count) return
  const month = new Date().toISOString().slice(0, 7)
  const paidPath = `/growth/${site.id}/paid`

  // Tracking health — the loudest one.
  for (const issue of await trackingHealth(site.id)) {
    const ok = await createEngineTaskOnce({
      title: `Check conversion tracking: ${issue.campaign} (${site.domain})`,
      context: {
        what: `${issue.platform === 'google' ? 'Google Ads' : 'Meta'} campaign "${issue.campaign}" spent ${issue.spend14d.toLocaleString('en-GB')} in 14 days with zero recorded conversions.`,
        why: 'Meaningful spend with no conversions for two weeks is almost always a broken tag, not bad performance — and it is the failure that quietly wastes the most money.',
        firstStep: 'Fire a test conversion and confirm it lands in the platform before touching bids.',
        link: paidPath,
      },
      priority: 'urgent',
      dueDate: today(),
      extraLabels: ['paid', 'tracking'],
    })
    if (ok) result.paid += 1
  }

  // Pacing.
  for (const p of await pacing(site.id, site.monthly_ads_budget)) {
    if (p.variancePct === null || Math.abs(p.variancePct) < 15) continue
    const ok = await createEngineTaskOnce({
      title: `Budget pacing ${p.variancePct > 0 ? 'over' : 'under'} on ${p.platform === 'google' ? 'Google Ads' : 'Meta'} (${site.domain}, ${month})`,
      context: {
        what: `Month-to-date spend ${p.spendMtd.toLocaleString('en-GB')} projects to ${p.projectedMonthEnd.toLocaleString('en-GB')} against a ${p.target?.toLocaleString('en-GB')} target (${p.variancePct > 0 ? '+' : ''}${p.variancePct}%).`,
        why: 'Projected from the daily run-rate so far this month.',
        firstStep: p.variancePct > 0 ? 'Lower daily budgets on the campaigns with the worst CPA first.' : 'Raise budgets where impression share is lost to budget, or accept the underspend deliberately.',
        link: paidPath,
      },
      extraLabels: ['paid', 'pacing'],
    })
    if (ok) result.paid += 1
  }

  // Wasted spend → negatives list.
  const wasted = await wastedSearchTerms(site.id)
  if (wasted.length > 0) {
    const groups = groupWastedTerms(wasted)
    const total = Math.round(wasted.reduce((s, t) => s + t.cost, 0))
    const ok = await createEngineTaskOnce({
      title: `Add negatives: ${wasted.length} zero-conversion search terms (${site.domain}, ${month})`,
      context: {
        what: `${wasted.length} search terms spent ${total.toLocaleString('en-GB')} over 60 days with no conversions.`,
        why: 'Every one of these is a click bought for nothing; negatives stop it tonight.',
        evidence: groups.slice(0, 8).map((g) => `${g.pattern} — ${g.cost.toLocaleString('en-GB')}: ${g.terms.slice(0, 4).join(', ')}${g.terms.length > 4 ? '…' : ''}`),
        firstStep: 'Paste the list below into a shared negative list.',
        link: paidPath,
      },
      description: `Negatives, ready to paste:\n${wasted.map((t) => t.search_term).join('\n')}`,
      extraLabels: ['paid', 'waste'],
    })
    if (ok) result.paid += 1
  }

  // Self-cannibalisation, monthly.
  if (new Date().getUTCDate() === 1) {
    const owned = await paidOnOwnedKeywords(site.id)
    if (owned.length > 0) {
      const top = owned.slice(0, 10)
      const ok = await createEngineTaskOnce({
        title: `Paying for owned keywords: ${owned.length} at organic 1-3 (${site.domain}, ${month})`,
        context: {
          what: `${site.name} ranks top-3 organically for ${owned.length} keywords it is also buying.`,
          why: `Top ten cost ${Math.round(top.reduce((s, k) => s + k.cost, 0)).toLocaleString('en-GB')} over 60 days. Some of it is defensible (brand, competitors bidding, high-value transactional terms); some is waste. Decide each with the organic position in view.`,
          evidence: top.map((k) => `"${k.keyword}" — organic ${k.organic_position}, paid ${k.cost.toLocaleString('en-GB')} for ${k.clicks} clicks, ${k.conversions} conv`),
          firstStep: 'For each: keep (defend), reduce bid, or pause and watch organic clicks for two weeks.',
          link: paidPath,
        },
        extraLabels: ['paid'],
      })
      if (ok) result.paid += 1
    }

    const handoffs = (await handoffOpportunities(site.id)).slice(0, 5)
    if (handoffs.length > 0) {
      const ok = await createEngineTaskOnce({
        title: `Handoff opportunities: ${handoffs.length} keywords (${site.domain}, ${month})`,
        context: {
          what: 'Keywords converting on paid where organic sits at 4-20 — the SEO work that makes the paid spend optional.',
          why: `Combined ${handoffs.reduce((s, h) => s + h.optional_spend_per_month, 0).toLocaleString('en-GB')} per month of spend becomes optional if organic reaches position 3 (CTR-curve model, current CPCs).`,
          evidence: handoffs.map((h) => `"${h.keyword}" — organic ${h.organic_position}, CPA ${h.cpa ?? '—'}, ${h.optional_spend_per_month}/mo optional, payback ${h.payback_months ?? '—'} months`),
          firstStep: 'Send the top entries to the refresh worksheet or brief queue.',
          link: paidPath,
        },
        extraLabels: ['paid', 'handoff'],
      })
      if (ok) result.paid += 1
    }
  }

  // Cover the gap while it closes.
  const cover = await coverGapKeywords(site.id)
  if (cover.length >= 3) {
    const ok = await createEngineTaskOnce({
      title: `Bid on ${cover.length} page-two commercial keywords while refreshes land (${site.domain}, ${month})`,
      context: {
        what: 'Commercial-intent keywords at organic 11-20 with no paid coverage.',
        why: 'Bid deliberately while the organic refresh lands, then step the bid down as position improves.',
        evidence: cover.slice(0, 8).map((k) => `"${k.keyword}" — organic ${k.organic_position}, ${k.gsc_impressions.toLocaleString('en-GB')} impressions (90d), est. CPC ${k.cpc ?? '—'}`),
        firstStep: 'Add as exact-match keywords to a "gap cover" ad group with a modest cap.',
        link: paidPath,
      },
      extraLabels: ['paid'],
    })
    if (ok) result.paid += 1
  }

  // Creative fatigue.
  for (const f of (await fatiguedCreatives(site.id)).slice(0, 3)) {
    const ok = await createEngineTaskOnce({
      title: `Refresh creative: ${f.creative.name ?? f.creative.external_id} (${site.domain})`,
      context: {
        what: `Frequency ${f.creative.frequency} with CTR down ${f.ctrDropPct}% against its own first-week baseline.`,
        why: 'The audience has seen it enough; it is now paying more per click for less attention.',
        evidence: [
          `Fatiguing: "${f.creative.headline ?? ''}" / ${(f.creative.primary_text ?? '').slice(0, 120)}`,
          f.replacement ? `Current top performer: "${f.replacement.headline ?? ''}" (CTR ${f.replacement.ctr})` : 'No clear top performer to model on',
        ],
        firstStep: 'Brief a replacement on the top performer’s angle with a new visual; pause the fatigued one once it is live.',
        link: paidPath,
      },
      extraLabels: ['paid', 'creative'],
    })
    if (ok) result.paid += 1
  }
}

// ── Reply classification (engine stop-on-reply already halted the sequence) ──

const REPLY_SYSTEM = `You classify a reply to a link-building outreach email.

Given the reply's subject and text, answer how the prospect responded.
- interested: willing to link, wants more info, or asks a real question
- declined: says no, not interested, paid-links-only, or asks not to be contacted
- other: out-of-office, ambiguous, or automated

Return strict JSON only: { "verdict": "interested" | "declined" | "other", "summary": string }`

async function classifyOutreachReplies(site: SeoSite, result: TaskGenResult): Promise<void> {
  const supabase = createClient()
  const { data: targets } = await supabase
    .from('seo_link_targets')
    .select('id, url, contact_id, recipient_id, accounts:crm_account_id(name)')
    .eq('site_id', site.id)
    .eq('status', 'outreach')
    .not('recipient_id', 'is', null)
    .is('reply_processed_at', null)

  for (const target of targets ?? []) {
    const { data: recipient } = await supabase
      .from('outreach_recipients')
      .select('stopped_reason')
      .eq('id', target.recipient_id as string)
      .maybeSingle()
    if (recipient?.stopped_reason !== 'replied') continue

    const { data: reply } = await supabase
      .from('email_logs')
      .select('subject, snippet, body_html, received_at')
      .eq('direction', 'inbound')
      .eq('contact_id', target.contact_id as string)
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const accountName = (target.accounts as unknown as { name: string } | null)?.name ?? target.url
    let verdict = 'other'
    let summary = 'Reply received'
    if (reply) {
      try {
        const bodyText = (reply.body_html ?? reply.snippet ?? '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 4000)
        const response = await anthropic.messages.create({
          model: ANTHROPIC_MODELS.HAIKU,
          max_tokens: 400,
          system: REPLY_SYSTEM,
          messages: [{ role: 'user', content: JSON.stringify({ subject: reply.subject, text: bodyText }) }],
        })
        const block = response.content.find((b) => b.type === 'text')
        const text = block && block.type === 'text' ? block.text : ''
        const parsed = JSON.parse(text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim()) as {
          verdict?: string
          summary?: string
        }
        if (parsed.verdict) verdict = parsed.verdict
        if (parsed.summary) summary = parsed.summary
      } catch {
        /* classification is best-effort — surface the reply as a task regardless */
      }
    }

    if (verdict === 'declined') {
      await supabase
        .from('seo_link_targets')
        .update({ status: 'lost', reply_processed_at: new Date().toISOString(), contact_note: `Declined: ${summary}` })
        .eq('id', target.id)
    } else {
      await createEngineTaskOnce({
        title: `Outreach reply: ${accountName}`,
        url: target.url,
        context: {
          what: `${verdict === 'interested' ? 'INTERESTED — ' : ''}${summary}`,
          why: 'A reply to the link pitch has landed; the engine stopped the sequence.',
          firstStep: 'Open the inbox thread and reply personally.',
          link: `/growth/${site.id}/links`,
        },
        dueDate: today(),
        priority: verdict === 'interested' ? 'high' : 'normal',
        extraLabels: ['outreach'],
      })
      await supabase
        .from('seo_link_targets')
        .update({ reply_processed_at: new Date().toISOString(), contact_note: `${verdict}: ${summary}` })
        .eq('id', target.id)
    }
    result.repliesClassified += 1
  }
}

// ── Win detection: a new referring domain that matches an open target ────────

async function detectWonLinks(site: SeoSite, result: TaskGenResult): Promise<void> {
  if (!dataForSeoConfigured()) return
  const supabase = createClient()
  const { data: open } = await supabase
    .from('seo_link_targets')
    .select('id, url, accounts:crm_account_id(name, website)')
    .eq('site_id', site.id)
    .in('status', ['identified', 'researching', 'outreach'])
  if (!open || open.length === 0) return

  const backlinks = await getCompetitorBacklinks(site.domain, 200)
  const byDomain = new Map(backlinks.map((b) => [b.domain_from.toLowerCase().replace(/^www\./, ''), b.url_from]))

  for (const target of open) {
    const account = target.accounts as unknown as { name: string; website: string | null } | null
    const domain = (account?.website ?? account?.name ?? '')
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
    if (!domain) continue
    const wonUrl = byDomain.get(domain)
    if (!wonUrl) continue

    await supabase
      .from('seo_link_targets')
      .update({ status: 'won', won_url: wonUrl, won_at: new Date().toISOString() })
      .eq('id', target.id)
    void notifyLinkWon(site.name, domain, wonUrl)
    result.linksWonDetected += 1
  }
}

/** C3: on publish, find published articles that mention the new article's
 *  cluster keywords and do not link to it yet — one task with sources + anchors. */
export async function internalLinkTaskForArticle(siteId: string, articleId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: article } = await supabase
    .from('seo_articles')
    .select('id, title, published_url, brief_id, site_id')
    .eq('id', articleId)
    .maybeSingle()
  if (!article?.published_url) return false
  const { data: brief } = article.brief_id
    ? await supabase.from('seo_briefs').select('cluster_id, target_keyword, secondary_keywords').eq('id', article.brief_id).maybeSingle()
    : { data: null }
  const keywords = new Set<string>()
  if (brief?.target_keyword) keywords.add(String(brief.target_keyword).toLowerCase())
  for (const k of (brief?.secondary_keywords as string[] | null) ?? []) keywords.add(k.toLowerCase())
  if (brief?.cluster_id) {
    const { data: members } = await supabase.from('seo_keywords').select('keyword').eq('cluster_id', brief.cluster_id).limit(30)
    for (const m of members ?? []) keywords.add(String(m.keyword).toLowerCase())
  }
  if (keywords.size === 0) return false

  const { data: others } = await supabase
    .from('seo_articles')
    .select('title, published_url, body_mdx')
    .eq('site_id', siteId)
    .eq('status', 'published')
    .neq('id', articleId)
    .not('published_url', 'is', null)
  const sources: Array<{ url: string; anchor: string }> = []
  for (const other of others ?? []) {
    const body = (other.body_mdx as string | null)?.toLowerCase() ?? ''
    if (!body || body.includes(article.published_url.toLowerCase())) continue
    const hit = [...keywords].find((k) => k.length > 3 && body.includes(k))
    if (hit) sources.push({ url: other.published_url as string, anchor: hit })
  }
  if (sources.length === 0) return false
  return createEngineTaskOnce({
    title: `Add internal links to ${article.title}`,
    url: article.published_url,
    context: {
      what: `${sources.length} published article${sources.length === 1 ? '' : 's'} already mention this topic and do not link to the new piece.`,
      why: 'Internal links are the cheapest ranking lever in the module; a new page with no inbound links waits weeks longer to rank.',
      evidence: sources.slice(0, 8).map((s) => `${s.url} — anchor "${s.anchor}"`),
      firstStep: 'Edit each source, add one contextual link on the suggested anchor, republish.',
      link: `/growth/${siteId}/articles`,
    },
    dueDate: today(),
    extraLabels: ['on-page', 'internal-links'],
  })
}
