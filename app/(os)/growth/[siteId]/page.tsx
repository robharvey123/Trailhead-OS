import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSeoSiteById, getSiteDashboardData } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'
import KeywordTable from '@/components/os/growth/KeywordTable'
import PipelineGuide from '@/components/os/growth/PipelineGuide'
import { PendingButton } from '@/components/growth/PendingButton'
import Sparkline from '@/components/os/growth/Sparkline'
import type { SeoGscDaily, SeoGrowthScore } from '@/lib/types'
import { researchKeywordsAction, syncGscNowAction } from '../actions'

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
  const data = await getSiteDashboardData(siteId, supabase)

  const syncAction = syncGscNowAction.bind(null, site.id)
  const researchAction = researchKeywordsAction.bind(null, site.id)

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
  ]

  // ── Next actions, ranked by how directly they move the engine forward ──
  const proposedBriefs = data.briefs.filter((b) => b.status === 'proposed').length
  const reviewArticles = data.articles.filter((a) => a.status === 'review').length
  const approvedArticles = data.articles.filter((a) => a.status === 'approved').length
  const proposedClusters = data.clusters.filter((c) => c.status === 'proposed').length
  const quickWins = data.keywords.filter(
    (k) => k.gsc_position !== null && k.gsc_position >= 11 && k.gsc_position <= 20
  ).length

  const nextActions: Array<{ label: string; href: string }> = []
  if (proposedBriefs > 0)
    nextActions.push({
      label: `Review ${proposedBriefs} brief${proposedBriefs === 1 ? '' : 's'} awaiting approval`,
      href: `/growth/${site.id}/briefs`,
    })
  if (reviewArticles > 0)
    nextActions.push({
      label: `Review ${reviewArticles} drafted article${reviewArticles === 1 ? '' : 's'}`,
      href: `/growth/${site.id}/articles`,
    })
  if (approvedArticles > 0)
    nextActions.push({
      label: `${approvedArticles} approved article${approvedArticles === 1 ? '' : 's'} awaiting publish`,
      href: `/growth/${site.id}/articles`,
    })
  if (proposedClusters > 0)
    nextActions.push({
      label: `Approve or reject ${proposedClusters} proposed cluster${proposedClusters === 1 ? '' : 's'}`,
      href: `/growth/${site.id}/clusters`,
    })
  if (quickWins > 0)
    nextActions.push({
      label: `${quickWins} quick-win keyword${quickWins === 1 ? '' : 's'} at position 11-20 — refresh those pages`,
      href: '#keywords',
    })
  if (!site.gsc_property)
    nextActions.push({ label: 'Add a Search Console property', href: `/growth/${site.id}/settings` })
  if (data.keywords.length === 0)
    nextActions.push({ label: 'Queue keyword research from seed terms', href: '#research' })
  if (data.keywords.length > 0 && data.clusters.length === 0)
    nextActions.push({
      label: 'Generate topic clusters from the keyword list',
      href: `/growth/${site.id}/clusters`,
    })
  const topActions = nextActions.slice(0, 3)

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
        ? 'Synced — real queries, clicks and positions flow in daily.'
        : site.gsc_property
          ? 'Property set — run the first sync (button top right).'
          : 'Add the GSC property in settings, then sync.',
      href: site.gsc_property ? '#' : `/growth/${site.id}/settings`,
      done: Boolean(site.last_gsc_sync_at),
    },
    {
      title: 'Build the keyword list',
      detail:
        'Queue DataForSEO research from seed terms below; results land within ~15 minutes. GSC adds the queries you already rank for.',
      href: '#research',
      done: data.keywords.length > 0,
    },
    {
      title: 'Group keywords into clusters',
      detail:
        'The model groups the list into topics worth owning. Generic clusters mean the ICP/brand voice in settings needs sharpening.',
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
        'Publishing creates a same-day distribution task. Mine competitor backlinks into CRM prospects on the Links page.',
      href: `/growth/${site.id}/links`,
      done: data.linkTargetCount > 0,
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      {/* Next actions */}
      <div className="os-card p-6">
        <h2 className="text-sm font-semibold text-[color:var(--text)]">Next actions</h2>
        {topActions.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--text-3)]">
            Nothing waiting on you — the engine is between cycles.
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {topActions.map((action, i) => (
              <li key={action.label}>
                <Link
                  href={action.href}
                  className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm text-[color:var(--text)] transition hover:border-[color:var(--accent)]"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-dim)] text-xs font-semibold text-[color:var(--accent-strong)]">
                    {i + 1}
                  </span>
                  {action.label}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Keyword table + AI visibility */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div id="keywords" className="os-card p-6 xl:col-span-2">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">
            Keywords ({data.keywords.length})
          </h2>
          {data.keywords.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
              No keywords yet. Sync GSC or queue keyword research below.
            </div>
          ) : (
            <div className="mt-4">
              <KeywordTable keywords={data.keywords} clusters={data.clusters} />
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
            Queue research
          </PendingButton>
        </form>
      </div>
    </div>
  )
}
