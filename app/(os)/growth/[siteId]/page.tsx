import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSeoSiteById, getSiteDashboardData } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'
import KeywordTable from '@/components/os/growth/KeywordTable'
import { PendingButton } from '@/components/growth/PendingButton'
import Sparkline from '@/components/os/growth/Sparkline'
import type { SeoGscDaily } from '@/lib/types'
import { syncGscNowAction } from '../actions'
import PageHeader from '@/components/ui/PageHeader'

export const metadata = { title: 'Growth site' }

// Growth is slimmed to Sites (Nov 2026): one page per site with Search Console
// performance, the Growth Score and the keyword table. The keyword research,
// briefs, articles, clusters, gap, links, paid and AI-prompt workflows were
// retired along with their crons; their tables are left in place.

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

function DeltaChip({ delta, goodWhenDown }: { delta: number | null; goodWhenDown?: boolean }) {
  if (delta === null || delta === 0) return null
  const improving = goodWhenDown ? delta < 0 : delta > 0
  return (
    <span
      className={`rounded-pill px-2 py-0.5 text-[11px] font-medium tabular-nums ${
        improving ? 'bg-[var(--emerald-dim)] text-[var(--emerald-strong)]' : 'bg-[var(--red-dim)] text-[var(--red-strong)]'
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

  const last28 = windowTotals(data.daily, 28, 0)
  const prev28 = windowTotals(data.daily, 56, 28)
  const recent = data.daily.slice(-28)
  const latestScore = data.scores[0] ?? null
  const previousScore = data.scores[1] ?? null

  const stats = [
    {
      label: 'Clicks · 28 days',
      value: last28.clicks.toLocaleString('en-GB'),
      delta: prev28.clicks > 0 || last28.clicks > 0 ? last28.clicks - prev28.clicks : null,
      series: recent.map((d) => d.clicks),
    },
    {
      label: 'Impressions · 28 days',
      value: last28.impressions.toLocaleString('en-GB'),
      delta: prev28.impressions > 0 || last28.impressions > 0 ? last28.impressions - prev28.impressions : null,
      series: recent.map((d) => d.impressions),
    },
    {
      label: 'Avg position · 28 days',
      value: last28.position === null ? '—' : String(last28.position),
      delta: last28.position !== null && prev28.position !== null ? last28.position - prev28.position : null,
      goodWhenDown: true,
      // Inverted so "line going up" means improving (position 1 is the top).
      series: recent.map((d) => d.position).filter((p): p is number => p !== null).map((p) => -p),
    },
    {
      label: 'Growth Score',
      value: latestScore ? String(latestScore.score) : '—',
      delta: latestScore && previousScore ? latestScore.score - previousScore.score : null,
      series: [...data.scores].reverse().map((s) => s.score),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/growth" className="hover:text-[color:var(--accent-strong)]">
            Sites
          </Link>
        }
        title={site.name}
        description={
          <>
            {site.domain}
            {site.last_gsc_sync_at
              ? ` · synced ${new Date(site.last_gsc_sync_at).toLocaleString('en-GB')}`
              : ' · never synced'}
          </>
        }
        actions={
          <>
            {site.gsc_property ? (
              <form action={syncAction}>
                <PendingButton pendingLabel="Syncing Search Console…">Sync GSC now</PendingButton>
              </form>
            ) : null}
            <Link href={`/growth/${site.id}/settings`} className="btn btn-secondary btn-sm">
              Settings
            </Link>
          </>
        }
      />

      {resolved?.error ? (
        <div className="rounded-card border border-[var(--red)]/40 bg-[var(--red-dim)] px-4 py-3 text-sm text-[var(--red-strong)]">
          {resolved.error}
        </div>
      ) : null}
      {resolved?.notice ? (
        <div className="rounded-card border border-[color:var(--accent)] bg-[var(--accent-dim)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">
          {resolved.notice}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="os-card p-5">
            <p className="os-label">{stat.label}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="stat-value">{stat.value}</span>
              <DeltaChip delta={stat.delta} goodWhenDown={stat.goodWhenDown} />
            </div>
            <div className="mt-3 h-[30px]">
              {stat.series.length >= 2 ? (
                <Sparkline values={stat.series} />
              ) : (
                <p className="text-xs text-[color:var(--text-3)]">History builds up over the coming days</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {latestScore ? (
        <div className="os-card p-6">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Growth Score breakdown</h2>
          <p className="mt-1 text-xs text-[color:var(--text-2)]">{latestScore.breakdown.summary}</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {latestScore.breakdown.components.map((c) => (
              <li key={c.key} className="text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[color:var(--text)]">{c.label}</span>
                  <span className="tabular-nums text-[color:var(--text-3)]">
                    {c.value === null ? 'no data' : `${Math.round(c.value * 100)}%`}
                  </span>
                </div>
                <p className="mt-0.5 text-[color:var(--text-3)]">{c.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="os-card p-6">
        <h2 className="text-sm font-semibold text-[color:var(--text)]">Keywords</h2>
        <p className="mt-1 text-xs text-[color:var(--text-3)]">Tracked keywords with Search Console clicks, impressions and position.</p>
        <div className="mt-4">
          <KeywordTable keywords={data.keywords} clusters={data.clusters} />
        </div>
      </div>
    </div>
  )
}
