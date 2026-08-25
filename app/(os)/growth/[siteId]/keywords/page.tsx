import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLatestSerpStates, getOpenPageIssues, getRefreshSummaries, getSeoKeywords, getSeoSiteById } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'
import KeywordTable, { type SerpStateLite } from '@/components/os/growth/KeywordTable'
import { PendingButton } from '@/components/growth/PendingButton'
import { pagesPerQuery, sitePages } from '@/lib/growth/pages'
import { encodePageUrl } from '@/lib/growth/refresh'
import { recrawlAction, runEnrichNowAction } from '../../actions'
import type { SeoCluster } from '@/lib/types'

/**
 * C4: the keyword coverage matrix, with the pages index and open technical
 * issues on the same route (?issues=1).
 */

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'border-red-300 bg-red-50 text-red-700',
  high: 'border-orange-300 bg-orange-50 text-orange-700',
  medium: 'border-amber-300 bg-amber-50 text-amber-700',
  low: 'border-[color:var(--border)] text-[color:var(--text-3)]',
}

export default async function GrowthKeywordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams?: Promise<{ error?: string; notice?: string; band?: string; target?: string; q?: string; source?: string; issues?: string }>
}) {
  const { siteId } = await params
  const resolved = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const site = await getSeoSiteById(siteId, supabase)
  if (!site) notFound()

  const [keywords, clustersRes, states, ppq, pages, issues, refreshes] = await Promise.all([
    getSeoKeywords(siteId, supabase),
    supabase.from('seo_clusters').select('*').eq('site_id', siteId),
    getLatestSerpStates(siteId, supabase),
    pagesPerQuery(siteId).catch(() => new Map<string, string[]>()),
    sitePages(siteId).catch(() => []),
    getOpenPageIssues(siteId, supabase),
    getRefreshSummaries(siteId, supabase),
  ])
  const clusters = (clustersRes.data ?? []) as SeoCluster[]
  const serpStates: Record<string, SerpStateLite> = {}
  for (const [id, s] of states) serpStates[id] = { our_position: s.our_position, ai_overview: s.ai_overview, ai_overview_cites_us: s.ai_overview_cites_us }
  const ppqCounts: Record<string, number> = {}
  for (const [q, list] of ppq) ppqCounts[q] = list.length

  const enriched = keywords.filter((k) => k.enriched_at).length
  const noTarget = keywords.filter((k) => k.ranking_url_checked_at && !k.ranking_url && (k.gsc_impressions ?? 0) > 0).length
  const multi = keywords.filter((k) => (ppqCounts[k.keyword] ?? 0) >= 2).length
  const showIssues = resolved?.issues === '1'
  const refreshByUrl = new Map(refreshes.map((r) => [r.url, r]))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="os-eyebrow">
            <Link href={`/growth/${site.id}`} className="hover:text-[color:var(--accent-strong)]">
              {site.name}
            </Link>
          </p>
          <h1 className="mt-2 os-page-title">Keywords &amp; pages</h1>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">
            {keywords.length.toLocaleString('en-GB')} keywords · {enriched.toLocaleString('en-GB')} with Labs difficulty and intent ·{' '}
            <Link href={`/growth/${site.id}/keywords?target=none`} className="underline decoration-[color:var(--border)] underline-offset-2">
              {noTarget} with impressions but no page
            </Link>{' '}
            (the content backlog) ·{' '}
            <Link href={`/growth/${site.id}/keywords?target=multi`} className="underline decoration-[color:var(--border)] underline-offset-2">
              {multi} held by two+ pages
            </Link>{' '}
            (cannibalisation)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={runEnrichNowAction.bind(null, site.id)}>
            <PendingButton pendingLabel="Calling DataForSEO Labs…">Enrich now (KD + intent)</PendingButton>
          </form>
          <form action={recrawlAction.bind(null, site.id)}>
            <PendingButton pendingLabel="Starting crawl…">{site.crawl_task_id ? 'Crawl running…' : 'Recrawl site'}</PendingButton>
          </form>
        </div>
      </div>

      {resolved?.error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{resolved.error}</div> : null}
      {resolved?.notice ? (
        <div className="rounded-2xl border border-[color:var(--accent)] bg-[var(--accent-dim)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">{resolved.notice}</div>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href={`/growth/${site.id}/keywords`} className={`rounded-full border px-3 py-1 ${!showIssues ? 'border-[color:var(--accent)] bg-[var(--accent-dim)] text-[color:var(--accent-strong)]' : 'border-[color:var(--border)] text-[color:var(--text-2)]'}`}>
          Keywords
        </Link>
        <Link href={`/growth/${site.id}/keywords?issues=1`} className={`rounded-full border px-3 py-1 ${showIssues ? 'border-[color:var(--accent)] bg-[var(--accent-dim)] text-[color:var(--accent-strong)]' : 'border-[color:var(--border)] text-[color:var(--text-2)]'}`}>
          Technical issues ({issues.length})
        </Link>
      </div>

      {showIssues ? (
        <div className="os-card p-6">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Open technical issues</h2>
          <p className="mt-1 text-xs text-[color:var(--text-3)]">
            {site.last_crawl_at ? `Last crawl ${new Date(site.last_crawl_at).toLocaleString('en-GB')} (up to ${site.max_crawl_pages} pages).` : 'No crawl yet — the growth-crawl job starts one on its next tick, or press Recrawl.'}{' '}
            Fixed issues resolve automatically on the next crawl. Critical and high issues become tasks (top 5).
          </p>
          {issues.length === 0 ? (
            <p className="mt-4 text-sm text-[color:var(--text-3)]">No open issues.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-[color:var(--text-3)]">
                    <th className="py-2 pr-3 font-medium">Severity</th>
                    <th className="py-2 pr-3 font-medium">Issue</th>
                    <th className="py-2 pr-3 font-medium">URL</th>
                    <th className="py-2 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((i) => (
                    <tr key={i.id} className="border-b border-[color:var(--border)] last:border-0">
                      <td className="py-2 pr-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${SEVERITY_STYLE[i.severity]}`}>{i.severity}</span>
                      </td>
                      <td className="py-2 pr-3 text-[color:var(--text)]">{i.issue_type.replace(/_/g, ' ')}</td>
                      <td className="py-2 pr-3 text-xs">
                        <Link href={`/growth/${site.id}/pages/${encodePageUrl(i.url)}`} className="text-[color:var(--accent-strong)] underline decoration-[color:var(--border)] underline-offset-2 break-all">
                          {i.url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                        </Link>
                      </td>
                      <td className="py-2 text-xs text-[color:var(--text-2)]">{i.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="os-card p-6">
            <h2 className="text-sm font-semibold text-[color:var(--text)]">Coverage matrix</h2>
            <div className="mt-4">
              <KeywordTable
                keywords={keywords}
                clusters={clusters}
                siteId={site.id}
                serpStates={serpStates}
                pagesPerQuery={ppqCounts}
                full
                initialFilters={{ band: resolved?.band, target: resolved?.target, q: resolved?.q, source: resolved?.source }}
              />
            </div>
          </div>

          <div className="os-card p-6">
            <h2 className="text-sm font-semibold text-[color:var(--text)]">Pages · last 28 days</h2>
            <p className="mt-1 text-xs text-[color:var(--text-3)]">Every URL with Search Console traffic. Open a page to get its refresh worksheet.</p>
            {pages.length === 0 ? (
              <p className="mt-4 text-sm text-[color:var(--text-3)]">No query×page history yet — it backfills on the first GSC sync after this release.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-[color:var(--text-3)]">
                      <th className="py-2 pr-3 font-medium">Page</th>
                      <th className="py-2 pr-3 text-right font-medium">Clicks</th>
                      <th className="py-2 pr-3 text-right font-medium">vs prior</th>
                      <th className="py-2 pr-3 text-right font-medium">Impr.</th>
                      <th className="py-2 pr-3 text-right font-medium">Pos.</th>
                      <th className="py-2 pr-3 text-right font-medium">Queries</th>
                      <th className="py-2 font-medium">Worksheet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pages.slice(0, 150).map((p) => {
                      const delta = p.clicks - p.prevClicks
                      const ws = refreshByUrl.get(p.url)
                      return (
                        <tr key={p.url} className="border-b border-[color:var(--border)] last:border-0">
                          <td className="py-2 pr-3 text-xs">
                            <Link href={`/growth/${site.id}/pages/${encodePageUrl(p.url)}`} className="text-[color:var(--accent-strong)] underline decoration-[color:var(--border)] underline-offset-2 break-all">
                              {p.url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                            </Link>
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{p.clicks.toLocaleString('en-GB')}</td>
                          <td className={`py-2 pr-3 text-right tabular-nums ${delta < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                            {delta > 0 ? '+' : ''}
                            {delta}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{p.impressions.toLocaleString('en-GB')}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{p.position ?? '—'}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{p.queries}</td>
                          <td className="py-2 text-xs text-[color:var(--text-3)]">
                            {ws ? `${ws.status}${ws.estimated_upside_clicks ? ` · +${ws.estimated_upside_clicks}/mo` : ''}` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
