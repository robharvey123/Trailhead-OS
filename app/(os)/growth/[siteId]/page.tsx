import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLatestSerpStates, getPaidTile, getRefreshSummaries, getSeoSiteById, getSiteDashboardData } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'
import KeywordTable, { type SerpStateLite } from '@/components/os/growth/KeywordTable'
import PipelineGuide from '@/components/os/growth/PipelineGuide'
import { PendingButton } from '@/components/growth/PendingButton'
import Sparkline from '@/components/os/growth/Sparkline'
import { estimatedMonthlyUpside } from '@/lib/growth/ctr'
import { worksheetPath } from '@/lib/growth/refresh'
import type { SeoGscDaily, SeoGrowthScore } from '@/lib/types'
import { expandSeedsAction, researchKeywordsAction, syncGscNowAction } from '../actions'

/** D5: an action names its object, shows the measurement + window, states the gain and links to a real destination. */
interface RankedAction {
  label: string
  href: string
  evidence: string
  why: string
  /** Estimated monthly clicks (or click-equivalents) at stake — the sort key. */
  value: number
  kind: 'organic' | 'paid' | 'pipeline'
}

interface StatDelta {
  value: string
  delta: number | null
  deltaGoodWhenDown?: boolean
}

function windowTotals(daily: SeoGscDaily[], fromDays: number, toDays: number) {
  const from = new Date(Date.now() - fromDays * 86400_000).toISOString().slice(0, 10)
  const to = new Date(Date.now() - toDays * 86400_000).toISOString().slice(0, 10)
  const rows = daily.filter((d) => d.date > from && d.date <= to)
  const clicks = rows.reduce((sum, d) => sum + d.clicks, 0)
  const impressions = rows.reduce((sum, d) => sum + d.impressions, 0)
  const positionWeighted = rows.reduce((sum, d) => sum + (d.position ?? 0) * d.impressions, 0)
  return {
    clicks,
    impressions,
    position: impressions > 0 ? Math.round((positionWeighted / impressions) * 10) / 10 : null,
  }
}

/** Progress-history series for one Growth Score component (oldest first). */
function componentSeries(scores: SeoGrowthScore[], key: string): number[] {
  return [...scores]
    .reverse()
    .map((s) => s.breakdown.components.find((c) => c.key === key)?.value)
    .filter((v): v is number => v !== null && v !== undefined)
}

function DeltaChip({ delta, goodWhenDown }: { delta: number | null; goodWhenDown?: boolean }) {
  if (delta === null || delta === 0) return null
  const improving = goodWhenDown ? delta < 0 : delta > 0
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${
        improving ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
      }`}
    >
      {delta > 0 ? '+' : ''}
      {Math.round(delta * 10) / 10}
    </span>
  )
}

export default async function GrowthSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams?: Promise<{ error?: string; notice?: string }>
}) {
  const { siteId } = await params
  const resolved = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const site = await getSeoSiteById(siteId, supabase)
  if (!site) notFound()
  const [data, serpStateMap, paidTile, refreshes] = await Promise.all([
    getSiteDashboardData(siteId, supabase),
    getLatestSerpStates(siteId, supabase).catch(() => new Map()),
    getPaidTile(siteId, supabase).catch(() => null),
    getRefreshSummaries(siteId, supabase).catch(() => []),
  ])
  const serpStates: Record<string, SerpStateLite> = {}
  for (const [id, st] of serpStateMap) serpStates[id] = { our_position: st.our_position, ai_overview: st.ai_overview, ai_overview_cites_us: st.ai_overview_cites_us }
  const aioPresent = Object.values(serpStates).filter((st) => st.ai_overview).length
  const aioCitesUs = Object.values(serpStates).filter((st) => st.ai_overview_cites_us).length
  const enrichedCount = data.keywords.filter((k) => k.enriched_at).length

  const syncAction = syncGscNowAction.bind(null, site.id)
  const researchAction = researchKeywordsAction.bind(null, site.id)
  const expandAction = expandSeedsAction.bind(null, site.id)

  // ── Stat cards ──
  const last28 = windowTotals(data.daily, 28, 0)
  const prev28 = windowTotals(data.daily, 56, 28)
  const clicksSeries = data.daily.slice(-28).map((d) => d.clicks)
  const positionSeries = data.daily
    .slice(-28)
    .map((d) => d.position)
    .filter((p): p is number => p !== null)
    // Inverted so "line going up" always means improving (position 1 is the top).
    .map((p) => -p)

  const aiRuns = data.mentions.length
  const aiHits = data.mentions.filter((m) => m.brand_mentioned).length
  const stats: Array<StatDelta & { label: string; series: number[]; caption?: string }> = [
    {
      label: 'Clicks · 28 days',
      value: last28.clicks.toLocaleString('en-GB'),
      delta: prev28.clicks > 0 || last28.clicks > 0 ? last28.clicks - prev28.clicks : null,
      series: clicksSeries,
    },
    {
      label: 'Avg position · 28 days',
      value: last28.position !== null ? String(last28.position) : '—',
      delta:
        last28.position !== null && prev28.position !== null
          ? Math.round((last28.position - prev28.position) * 10) / 10
          : null,
      deltaGoodWhenDown: true,
      series: positionSeries,
    },
    {
      label: 'Referring domains',
      value: site.referring_domains !== null ? site.referring_domains.toLocaleString('en-GB') : '—',
      delta: null,
      series: componentSeries(data.scores, 'referring_domains'),
      caption:
        site.referring_domains_checked_at === null
          ? 'Checked nightly once DataForSEO is configured'
          : undefined,
    },
    {
      label: 'AI mention rate · 28 days',
      value: aiRuns > 0 ? `${Math.round((aiHits / aiRuns) * 100)}%` : '—',
      delta: null,
      series: componentSeries(data.scores, 'ai_mentions'),
      caption: aiRuns === 0 ? 'Starts with AI visibility tracking (Phase 6)' : `${aiRuns} answers checked`,
    },
    {
      label: 'Google AI Overviews',
      value: aioPresent > 0 ? `${aioCitesUs}/${aioPresent}` : '—',
      delta: null,
      series: [],
      caption: aioPresent > 0 ? `${aioPresent} tracked SERPs show an AI Overview; ${aioCitesUs} cite ${site.name}` : 'From SERP snapshots — none parsed yet',
    },
    ...(paidTile
      ? [
          {
            label: 'Ad spend · month to date',
            value: paidTile.spend.toLocaleString('en-GB'),
            delta: null,
            series: [],
            caption: paidTile.cpa !== null ? `${paidTile.conversions} conversions · CPA ${paidTile.cpa.toLocaleString('en-GB')}` : `${paidTile.conversions} conversions`,
          },
        ]
      : []),
  ]

  // ── Next actions — ranked by estimated value, never linking to an anchor ──
  const proposedBriefs = data.briefs.filter((b) => b.status === 'proposed').length
  const reviewArticles = data.articles.filter((a) => a.status === 'review').length
  const approvedArticles = data.articles.filter((a) => a.status === 'approved').length
  const proposedClusters = data.clusters.filter((c) => c.status === 'proposed').length
  const quickWinRows = data.keywords.filter((k) => k.gsc_position !== null && k.gsc_position >= 11 && k.gsc_position <= 20)
  const quickWins = quickWinRows.length

  const actions: RankedAction[] = []

  // Quick wins grouped by the page that owns them (D1) → the worksheet (D2).
  const byPage = new Map<string, { upside: number; queries: number; impressions: number }>()
  let orphanQuickWins = 0
  for (const k of quickWinRows) {
    const upside = estimatedMonthlyUpside(k.gsc_impressions ?? 0, k.gsc_position, 90)
    if (k.ranking_url) {
      const e = byPage.get(k.ranking_url) ?? { upside: 0, queries: 0, impressions: 0 }
      e.upside += upside
      e.queries += 1
      e.impressions += k.gsc_impressions ?? 0
      byPage.set(k.ranking_url, e)
    } else orphanQuickWins += 1
  }
  for (const [url, e] of [...byPage.entries()].sort((a, b) => b[1].upside - a[1].upside).slice(0, 3)) {
    let path = url
    try {
      path = new URL(url).pathname
    } catch {
      /* keep */
    }
    actions.push({
      label: `Refresh ${path}`,
      href: worksheetPath(site.id, url),
      evidence: `${e.queries} quer${e.queries === 1 ? 'y' : 'ies'} at positions 11-20, ${e.impressions.toLocaleString('en-GB')} impressions (90-day Search Console)`,
      why: 'Page two to page one on a page that already ranks is the cheapest traffic in the module.',
      value: e.upside,
      kind: 'organic',
    })
  }
  if (orphanQuickWins > 0 && byPage.size === 0 && !site.last_gsc_backfill_at) {
    actions.push({
      label: `${quickWins} quick-win keyword${quickWins === 1 ? '' : 's'} at position 11-20 — pages resolve after the next GSC sync`,
      href: `/growth/${site.id}/keywords?band=11-20`,
      evidence: 'Query→page history backfills on the first sync after this release.',
      why: 'Until then the module cannot say which page to refresh.',
      value: quickWinRows.reduce((s, k) => s + estimatedMonthlyUpside(k.gsc_impressions ?? 0, k.gsc_position, 90), 0),
      kind: 'organic',
    })
  } else if (orphanQuickWins >= 3) {
    actions.push({
      label: `${orphanQuickWins} page-two queries have no owning page`,
      href: `/growth/${site.id}/keywords?target=none`,
      evidence: 'Impressions at 11-20 but no single URL holds them (28-day query×page data).',
      why: 'A deliberate new page usually wins these faster than refreshing whichever page Google half-matches.',
      value: quickWinRows.filter((k) => !k.ranking_url).reduce((s, k) => s + estimatedMonthlyUpside(k.gsc_impressions ?? 0, k.gsc_position, 90), 0),
      kind: 'organic',
    })
  }

  const openRefreshes = refreshes.filter((r) => r.status === 'open')
  if (openRefreshes.length > 0) {
    const top = openRefreshes.sort((a, b) => (b.estimated_upside_clicks ?? 0) - (a.estimated_upside_clicks ?? 0))[0]
    let path = top.url
    try {
      path = new URL(top.url).pathname
    } catch {
      /* keep */
    }
    actions.push({
      label: `Finish the open worksheet for ${path}`,
      href: worksheetPath(site.id, top.url),
      evidence: `${openRefreshes.length} worksheet${openRefreshes.length === 1 ? '' : 's'} generated, not yet applied`,
      why: 'A change list that never ships earns nothing; apply it as a PR or mark it done.',
      value: top.estimated_upside_clicks ?? 0,
      kind: 'organic',
    })
  }

  if (paidTile?.hasAccounts) {
    const { minedSearchTerms, handoffOpportunities, wastedSearchTerms } = await import('@/lib/growth/paid-loops')
    const [mined, handoffs, wasted] = await Promise.all([
      minedSearchTerms(siteId).catch(() => []),
      handoffOpportunities(siteId).catch(() => []),
      wastedSearchTerms(siteId).catch(() => []),
    ])
    if (mined.length > 0)
      actions.push({
        label: `${mined.length} converting search terms have no organic page`,
        href: `/growth/${site.id}/paid?tab=search`,
        evidence: `${Math.round(mined.reduce((s, t) => s + t.conversion_value, 0)).toLocaleString('en-GB')} of conversion value on queries with no page in Search Console (60-day Ads window)`,
        why: 'Proven commercial demand, already paid for once. The strongest content backlog the module can produce.',
        value: Math.round(mined.reduce((s, t) => s + t.clicks, 0) / 2),
        kind: 'paid',
      })
    if (wasted.length > 0)
      actions.push({
        label: `Add ${wasted.length} negatives — ${Math.round(wasted.reduce((s, t) => s + t.cost, 0)).toLocaleString('en-GB')} spent on zero-conversion terms`,
        href: `/growth/${site.id}/paid?tab=search`,
        evidence: '60-day search terms report, terms above the spend threshold with no conversions',
        why: 'Every one of these is a click bought for nothing; negatives stop it tonight.',
        value: Math.round(wasted.reduce((s, t) => s + t.clicks, 0)),
        kind: 'paid',
      })
    if (handoffs.length > 0)
      actions.push({
        label: `${handoffs.length} paid keywords where organic could take over`,
        href: `/growth/${site.id}/paid?tab=search`,
        evidence: `${handoffs.reduce((s, h) => s + h.optional_spend_per_month, 0).toLocaleString('en-GB')} per month becomes optional at organic position 3 (CTR-curve model)`,
        why: 'The number that sells the retainer to a client already spending on Ads.',
        value: handoffs.reduce((s, h) => s + h.organic_clicks_at_3, 0),
        kind: 'paid',
      })
  }

  // Pipeline actions: value is the queue depth scaled so they sit below real traffic wins but above nothing.
  if (proposedBriefs > 0)
    actions.push({ label: `Review ${proposedBriefs} brief${proposedBriefs === 1 ? '' : 's'} awaiting approval`, href: `/growth/${site.id}/briefs`, evidence: `${proposedBriefs} proposed`, why: 'Approval queues the draft; nothing gets written until you say so.', value: proposedBriefs * 5, kind: 'pipeline' })
  if (reviewArticles > 0)
    actions.push({ label: `Review ${reviewArticles} drafted article${reviewArticles === 1 ? '' : 's'}`, href: `/growth/${site.id}/articles`, evidence: `${reviewArticles} in review`, why: 'Drafts only earn once published.', value: reviewArticles * 8, kind: 'pipeline' })
  if (approvedArticles > 0)
    actions.push({ label: `Publish ${approvedArticles} approved article${approvedArticles === 1 ? '' : 's'}`, href: `/growth/${site.id}/articles`, evidence: `${approvedArticles} approved, unpublished`, why: 'One click from live.', value: approvedArticles * 10, kind: 'pipeline' })
  if (proposedClusters > 0)
    actions.push({ label: `Approve or reject ${proposedClusters} proposed cluster${proposedClusters === 1 ? '' : 's'}`, href: `/growth/${site.id}/clusters`, evidence: `${proposedClusters} proposed`, why: 'Approval creates the content programme on the Gantt.', value: proposedClusters * 3, kind: 'pipeline' })
  if (!site.gsc_property)
    actions.push({ label: 'Add a Search Console property', href: `/growth/${site.id}/settings`, evidence: 'No property set', why: 'Without it the module has no real ranking data at all.', value: 1000, kind: 'pipeline' })
  if (data.keywords.length === 0)
    actions.push({ label: 'Queue keyword research from seed terms', href: `/growth/${site.id}/keywords`, evidence: 'Keyword list is empty', why: 'Everything downstream needs a list.', value: 500, kind: 'pipeline' })
  if (data.keywords.length > 0 && enrichedCount === 0)
    actions.push({ label: 'Enrich the keyword list with real difficulty and intent', href: `/growth/${site.id}/keywords`, evidence: `${data.keywords.length} keywords, none enriched`, why: 'Until then difficulty is unknown and intent is a guess; every prioritisation call rests on it.', value: 200, kind: 'pipeline' })
  if (data.keywords.length > 0 && data.clusters.length === 0)
    actions.push({ label: 'Generate topic clusters from the keyword list', href: `/growth/${site.id}/clusters`, evidence: `${data.keywords.length} keywords, no clusters`, why: 'Clusters are what briefs get written against.', value: 50, kind: 'pipeline' })

  const topActions = [...actions].sort((a, b) => b.value - a.value).slice(0, 5)

  // ── Content pipeline ──
  const pipeline = [
    { label: 'Proposed', count: data.briefs.filter((b) => b.status === 'proposed').length },
    { label: 'Approved', count: data.briefs.filter((b) => b.status === 'approved').length },
    { label: 'Drafting', count: data.articles.filter((a) => a.status === 'drafting').length },
    { label: 'Review', count: reviewArticles + approvedArticles },
    { label: 'Published', count: data.articles.filter((a) => a.status === 'published').length },
  ]

  // ── AI visibility panel ──
  const byProvider = new Map<string, { runs: number; hits: number }>()
  const competitorCounts = new Map<string, number>()
  for (const m of data.mentions) {
    const p = byProvider.get(m.provider) ?? { runs: 0, hits: 0 }
    p.runs += 1
    if (m.brand_mentioned) p.hits += 1
    byProvider.set(m.provider, p)
    for (const c of m.competitors_mentioned) {
      competitorCounts.set(c, (competitorCounts.get(c) ?? 0) + 1)
    }
  }
  const topCompetitors = [...competitorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  const latestScore = data.scores[0] ?? null

  // ── The engine as a checklist — done-states derived from live data ──
  const anyClusterApproved = data.clusters.some((c) => c.status === 'approved')
  const anyBriefApproved = data.briefs.some((b) => b.status === 'approved' || b.status === 'drafted')
  const anyArticleReady = data.articles.some((a) => a.status === 'approved' || a.status === 'published')
  const anyPublished = data.articles.some((a) => a.status === 'published')
  const pipelineSteps = [
    {
      title: 'Connect Search Console',
      detail: site.last_gsc_sync_at
        ? 'Synced — real queries, clicks, positions and the query→page history flow in daily.'
        : site.gsc_property
          ? 'Property set — run the first sync (button top right). Needs: the Google grant with the Search Console scope. Costs: nothing. Produces: 90 days of query×page history. Takes: about a minute.'
          : 'Add the GSC property in settings, then sync. Needs: the property verified in Search Console. Costs: nothing.',
      href: site.gsc_property ? '#' : `/growth/${site.id}/settings`,
      done: Boolean(site.last_gsc_sync_at),
    },
    {
      title: 'Build the keyword list',
      detail:
        'Seed terms below → Google Ads ideas (Standard queue, ~$0.05 per seed batch, lands in ~15 minutes) and Labs suggestions (instant, ~$0.02 per seed). GSC adds what you already rank for. Later: the competitor gap view.',
      href: `/growth/${site.id}/keywords`,
      done: data.keywords.length > 0,
    },
    {
      title: 'Enrich with real difficulty and intent',
      detail:
        'DataForSEO Labs KD + search intent, 1,000 keywords per call, fractions of a penny each. Runs nightly at 05:30; press Enrich now on the keywords page to do it immediately. Produces: the KD column and measured intent chips.',
      href: `/growth/${site.id}/keywords`,
      done: enrichedCount > 0,
    },
    {
      title: 'Group keywords into clusters',
      detail:
        'Preferred: SERP overlap — needs a snapshot per keyword (~$0.0006 each, ~15 minutes), then clusters are measured from shared top-10 URLs and the model only names them. Fallback: the model groups by keyword text alone.',
      href: `/growth/${site.id}/clusters`,
      done: data.clusters.length > 0,
    },
    {
      title: 'Approve a cluster',
      detail: 'Approval creates a content-programme Project on the Gantt.',
      href: `/growth/${site.id}/clusters`,
      done: anyClusterApproved,
    },
    {
      title: 'Generate and approve a brief',
      detail:
        'A brief needs a SERP snapshot for its pillar keyword (auto-queued if missing). Approving it queues the draft.',
      href: `/growth/${site.id}/briefs`,
      done: anyBriefApproved,
    },
    {
      title: 'Review the draft',
      detail: 'The drafting job runs every 5 minutes and pushes you a notification. Read it, then approve.',
      href: `/growth/${site.id}/articles`,
      done: anyArticleReady,
    },
    {
      title: 'Publish',
      detail:
        site.cms_type === 'none'
          ? 'Pick a publish target in settings first: Trailhead marketing blog, a GitHub repo (PR), or WordPress (draft).'
          : 'Publish from the article page — always gated: PR to merge, or a draft to review.',
      href: site.cms_type === 'none' ? `/growth/${site.id}/settings` : `/growth/${site.id}/articles`,
      done: anyPublished,
    },
    {
      title: 'Distribute and build links',
      detail:
        'Publishing creates a same-day distribution task and an internal-links task. Mine competitor backlinks into CRM prospects on the Links page (one Live call per competitor, a few pence).',
      href: `/growth/${site.id}/links`,
      done: data.linkTargetCount > 0,
    },
    {
      title: 'Link paid media',
      detail: paidTile?.hasAccounts
        ? 'Linked — the search terms report and conversion data flow onto the keyword list nightly.'
        : 'Optional but the single best first-party keyword source. Needs: Google Ads API access (developer token on the MCC, days to approve) and/or a Meta system user token. Costs: nothing per call. Produces: converting search terms with no organic page, wasted spend, the handoff model.',
      href: `/growth/${site.id}/paid`,
      done: Boolean(paidTile?.hasAccounts),
    },
    {
      title: 'Measure: AI visibility + monthly report',
      detail:
        'Activate buyer-intent prompts (weekly runs against the AI engines) and send the monthly report from the sub-nav.',
      href: `/growth/${site.id}/prompts`,
      done: data.activePromptCount > 0,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="os-eyebrow">
            <Link href="/growth" className="hover:text-[color:var(--accent-strong)]">
              Growth
            </Link>
          </p>
          <h1 className="mt-2 os-page-title">{site.name}</h1>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">
            {site.domain}
            {site.last_gsc_sync_at
              ? ` · synced ${new Date(site.last_gsc_sync_at).toLocaleString('en-GB')}`
              : ' · never synced'}
          </p>
          <p className="mt-2 flex flex-wrap gap-3 text-sm">
            {[
              { href: `/growth/${site.id}/keywords`, label: 'Keywords & pages' },
              { href: `/growth/${site.id}/gap`, label: 'Competitor gap' },
              { href: `/growth/${site.id}/paid`, label: 'Paid' },
              { href: `/growth/${site.id}/clusters`, label: 'Clusters' },
              { href: `/growth/${site.id}/briefs`, label: 'Briefs' },
              { href: `/growth/${site.id}/articles`, label: 'Articles' },
              { href: `/growth/${site.id}/links`, label: 'Links' },
              { href: `/growth/${site.id}/prompts`, label: 'AI prompts' },
              { href: `/api/growth/report/${site.id}`, label: 'Monthly report' },
              { href: `/growth/${site.id}/settings`, label: 'Settings' },
            ].map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="text-[color:var(--text-2)] underline decoration-[color:var(--border)] underline-offset-4 hover:text-[color:var(--accent-strong)]"
              >
                {tab.label}
              </Link>
            ))}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {site.gsc_property ? (
            <form action={syncAction}>
              <PendingButton pendingLabel="Syncing Search Console…">Sync GSC now</PendingButton>
            </form>
          ) : null}
          <div className="group relative" tabIndex={0}>
            <div className="os-card flex items-center gap-3 px-5 py-3">
              <span className="text-2xl font-semibold tabular-nums text-[color:var(--text)]">
                {latestScore ? latestScore.score : '—'}
              </span>
              <span className="text-xs leading-tight text-[color:var(--text-3)]">
                Growth
                <br />
                Score
              </span>
            </div>
            <div className="invisible absolute right-0 top-full z-20 mt-2 w-80 rounded-2xl border border-[color:var(--border)] bg-white p-4 shadow-lg group-focus-within:visible group-hover:visible">
              {latestScore ? (
                <>
                  <p className="text-xs text-[color:var(--text-2)]">{latestScore.breakdown.summary}</p>
                  <ul className="mt-3 space-y-2">
                    {latestScore.breakdown.components.map((c) => (
                      <li key={c.key} className="text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-[color:var(--text)]">{c.label}</span>
                          <span className="tabular-nums text-[color:var(--text-3)]">
                            {c.value === null ? 'no data' : `${Math.round(c.value * 100)}%`} · w{' '}
                            {c.weight}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[color:var(--text-3)]">{c.detail}</p>
                        {c.raise ? (
                          <p className="mt-0.5 text-[color:var(--text-2)]">
                            ↑ {c.raise}
                            {c.href ? (
                              <>
                                {' '}
                                <Link href={c.href} className="text-[color:var(--accent-strong)] underline decoration-[color:var(--border)] underline-offset-2">
                                  go
                                </Link>
                              </>
                            ) : null}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-xs text-[color:var(--text-3)]">
                  Computed nightly — the first score lands after the next growth-score run.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {resolved?.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {resolved.error}
        </div>
      ) : null}
      {resolved?.notice ? (
        <div className="rounded-2xl border border-[color:var(--accent)] bg-[var(--accent-dim)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
          {resolved.notice}
        </div>
      ) : null}

      <PipelineGuide steps={pipelineSteps} />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="os-card p-5">
            <p className="text-xs uppercase tracking-wide text-[color:var(--text-3)]">{stat.label}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-2xl font-semibold tabular-nums text-[color:var(--text)]">
                {stat.value}
              </span>
              <DeltaChip delta={stat.delta} goodWhenDown={stat.deltaGoodWhenDown} />
            </div>
            <div className="mt-3 h-[30px]">
              {stat.series.length >= 2 ? (
                <Sparkline values={stat.series} />
              ) : (
                <p className="text-xs text-[color:var(--text-3)]">
                  {stat.caption ?? 'History builds up over the coming days'}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Next actions — organic and paid compete in one list, ranked by estimated value */}
      <div className="os-card p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Next actions</h2>
          <p className="text-xs text-[color:var(--text-3)]">Ranked by estimated monthly clicks at stake (CTR-curve model for organic; paid figures from your Ads data)</p>
        </div>
        {topActions.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--text-3)]">Nothing waiting on you — the engine is between cycles.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {topActions.map((action, i) => (
              <li key={action.label}>
                <Link
                  href={action.href}
                  className="flex items-start gap-3 rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm transition hover:border-[color:var(--accent)]"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-dim)] text-xs font-semibold text-[color:var(--accent-strong)]">
                    {i + 1}
                  </span>
                  <span className="min-w-0 grow">
                    <span className="block font-medium text-[color:var(--text)]">
                      {action.label}
                      <span
                        className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          action.kind === 'paid'
                            ? 'border-violet-200 bg-violet-50 text-violet-700'
                            : action.kind === 'organic'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-[color:var(--border)] text-[color:var(--text-3)]'
                        }`}
                      >
                        {action.kind}
                      </span>
                    </span>
                    <span className="block text-xs text-[color:var(--text-2)]">{action.evidence}</span>
                    <span className="block text-xs text-[color:var(--text-3)]">{action.why}</span>
                  </span>
                  {action.kind !== 'pipeline' ? (
                    <span className="shrink-0 text-right text-xs tabular-nums text-[color:var(--text-2)]" title="Estimated monthly clicks at stake">
                      ~{action.value.toLocaleString('en-GB')}
                      <span className="block text-[10px] text-[color:var(--text-3)]">clicks/mo</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Keyword table + AI visibility */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div id="keywords" className="os-card p-6 xl:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-[color:var(--text)]">Keywords ({data.keywords.length})</h2>
            <Link href={`/growth/${site.id}/keywords`} className="text-xs text-[color:var(--accent-strong)] underline decoration-[color:var(--border)] underline-offset-2">
              Full coverage matrix, pages and technical issues →
            </Link>
          </div>
          {data.keywords.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
              No keywords yet. Sync GSC or queue keyword research below.
            </div>
          ) : (
            <div className="mt-4">
              <KeywordTable keywords={data.keywords} clusters={data.clusters} siteId={site.id} serpStates={serpStates} />
            </div>
          )}
        </div>

        <div className="os-card p-6">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">AI visibility</h2>
          {byProvider.size === 0 ? (
            <p className="mt-3 text-sm text-[color:var(--text-3)]">
              No AI answer tracking yet — weekly prompt runs against Anthropic, OpenAI and
              Perplexity arrive in Phase 6. The panel will show how often each one recommends{' '}
              {site.name}, and who gets named instead.
            </p>
          ) : (
            <>
              <ul className="mt-3 space-y-2">
                {[...byProvider.entries()].map(([provider, { runs, hits }]) => (
                  <li key={provider} className="flex items-center justify-between text-sm">
                    <span className="text-[color:var(--text)]">{provider}</span>
                    <span className="tabular-nums text-[color:var(--text-2)]">
                      {Math.round((hits / runs) * 100)}% of {runs}
                    </span>
                  </li>
                ))}
              </ul>
              {topCompetitors.length > 0 ? (
                <>
                  <h3 className="mt-5 text-xs uppercase tracking-wide text-[color:var(--text-3)]">
                    Named instead of us
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {topCompetitors.map(([name, count]) => (
                      <li key={name} className="flex items-center justify-between text-sm">
                        <span className="text-[color:var(--text-2)]">{name}</span>
                        <span className="tabular-nums text-[color:var(--text-3)]">{count}×</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Content pipeline */}
      <div className="os-card p-6">
        <h2 className="text-sm font-semibold text-[color:var(--text)]">Content pipeline</h2>
        <div className="mt-4 flex items-stretch gap-2 overflow-x-auto">
          {pipeline.map((stage, i) => (
            <div key={stage.label} className="flex min-w-28 grow items-center gap-2">
              <div className="grow rounded-2xl border border-[color:var(--border)] px-4 py-3 text-center">
                <p className="text-lg font-semibold tabular-nums text-[color:var(--text)]">
                  {stage.count}
                </p>
                <p className="mt-0.5 text-xs text-[color:var(--text-3)]">{stage.label}</p>
              </div>
              {i < pipeline.length - 1 ? (
                <span aria-hidden="true" className="shrink-0 text-[color:var(--text-3)]">
                  →
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Keyword research */}
      <div id="research" className="os-card p-6">
        <h2 className="text-sm font-semibold text-[color:var(--text)]">Keyword research</h2>
        <p className="mt-1 text-sm text-[color:var(--text-2)]">
          Queue DataForSEO keyword ideas from seed terms (comma or newline separated). Results land
          within ~15 minutes via the collect job.
        </p>
        <form action={researchAction} className="mt-4 flex flex-wrap items-start gap-3">
          <textarea
            name="seeds"
            rows={2}
            required
            placeholder="job management software, field service app, digital job sheets"
            className="min-w-64 grow rounded-2xl border border-[color:var(--border)] bg-white px-4 py-2.5 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-3)] focus:border-[color:var(--accent)] focus:outline-none"
          />
          <PendingButton variant="primary" pendingLabel="Queueing with DataForSEO…">
            Queue research (Google Ads ideas)
          </PendingButton>
        </form>
        <form action={expandAction} className="mt-3 flex flex-wrap items-start gap-3">
          <textarea
            name="seeds"
            rows={1}
            required
            placeholder="Up to 5 seeds for Labs suggestions + related keywords (instant, tagged by source)"
            className="min-w-64 grow rounded-2xl border border-[color:var(--border)] bg-white px-4 py-2.5 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-3)] focus:border-[color:var(--accent)] focus:outline-none"
          />
          <PendingButton pendingLabel="Asking DataForSEO Labs…">Expand with Labs</PendingButton>
        </form>
      </div>
    </div>
  )
}
