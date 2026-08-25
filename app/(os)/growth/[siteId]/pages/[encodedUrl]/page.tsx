import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSeoSiteById } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'
import { PendingButton } from '@/components/growth/PendingButton'
import WorksheetChecklist from '@/components/os/growth/WorksheetChecklist'
import { changeItemKeys, decodePageUrl, getWorksheet } from '@/lib/growth/refresh'
import { pageStats } from '@/lib/growth/pages'
import { CTR_MODEL_LABEL } from '@/lib/growth/ctr'
import { generateWorksheetAction, openRefreshPrAction, setWorksheetStatusAction } from '../../../actions'

/**
 * D2: the refresh worksheet — one per URL, where a refresh actually gets done.
 */

function fmt(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : n.toLocaleString('en-GB')
}

function Delta({ now, prev }: { now: number; prev: number }) {
  if (prev === 0 && now === 0) return null
  const delta = now - prev
  const pct = prev > 0 ? Math.round((delta / prev) * 100) : null
  return (
    <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
      {delta >= 0 ? '+' : ''}
      {delta}
      {pct !== null ? ` (${pct >= 0 ? '+' : ''}${pct}%)` : ''} vs prior 28d
    </span>
  )
}

export default async function RefreshWorksheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string; encodedUrl: string }>
  searchParams?: Promise<{ error?: string; notice?: string }>
}) {
  const { siteId, encodedUrl } = await params
  const resolved = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const site = await getSeoSiteById(siteId, supabase)
  if (!site) notFound()
  let url: string
  try {
    url = decodePageUrl(encodedUrl)
  } catch {
    notFound()
  }

  const [worksheet, live] = await Promise.all([getWorksheet(siteId, url), pageStats(siteId, url)])
  const payload = worksheet?.payload ?? null
  const stats = payload?.stats ?? live
  const items = payload?.change_list ? changeItemKeys(payload.change_list) : []
  let path = url
  try {
    path = new URL(url).pathname
  } catch {
    /* keep */
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="os-eyebrow">
            <Link href={`/growth/${site.id}`} className="hover:text-[color:var(--accent-strong)]">
              {site.name}
            </Link>
            <span className="mx-2 text-[color:var(--text-3)]">/</span>
            <Link href={`/growth/${site.id}/keywords`} className="hover:text-[color:var(--accent-strong)]">
              Keywords
            </Link>
          </p>
          <h1 className="mt-2 os-page-title break-all">Refresh: {path}</h1>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">
            <a href={url} target="_blank" rel="noreferrer" className="underline decoration-[color:var(--border)] underline-offset-2 hover:text-[color:var(--accent-strong)]">
              {url}
            </a>
            {worksheet ? ` · worksheet generated ${new Date(worksheet.generated_at).toLocaleString('en-GB')} · ${worksheet.status}` : ' · no worksheet yet'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={generateWorksheetAction.bind(null, site.id, encodedUrl)}>
            <PendingButton variant="primary" pendingLabel="Reading the page and the SERP…">
              {worksheet ? 'Regenerate worksheet' : 'Generate worksheet'}
            </PendingButton>
          </form>
          {worksheet && worksheet.status === 'open' ? (
            <>
              {site.cms_type === 'github' || site.cms_type === 'wordpress' ? (
                <form action={openRefreshPrAction.bind(null, site.id, encodedUrl)}>
                  <PendingButton pendingLabel={site.cms_type === 'github' ? 'Opening pull request…' : 'Creating WP draft…'}>
                    {site.cms_type === 'github' ? 'Apply ticked items as PR' : 'Apply ticked items as WP draft'}
                  </PendingButton>
                </form>
              ) : null}
              <form action={setWorksheetStatusAction.bind(null, site.id, encodedUrl, 'applied')}>
                <PendingButton pendingLabel="Saving…">Mark applied</PendingButton>
              </form>
              <form action={setWorksheetStatusAction.bind(null, site.id, encodedUrl, 'dismissed')}>
                <PendingButton pendingLabel="Saving…">Dismiss</PendingButton>
              </form>
            </>
          ) : worksheet ? (
            <form action={setWorksheetStatusAction.bind(null, site.id, encodedUrl, 'open')}>
              <PendingButton pendingLabel="Saving…">Reopen</PendingButton>
            </form>
          ) : null}
        </div>
      </div>

      {resolved?.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{resolved.error}</div>
      ) : null}
      {resolved?.notice ? (
        <div className="rounded-2xl border border-[color:var(--accent)] bg-[var(--accent-dim)] px-4 py-3 text-sm text-[color:var(--accent-strong)]">{resolved.notice}</div>
      ) : null}
      {worksheet?.pr_url ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Applied via{' '}
          <a href={worksheet.pr_url.startsWith('http') ? worksheet.pr_url : '#'} target="_blank" rel="noreferrer" className="underline">
            {worksheet.pr_url.startsWith('http') ? 'pull request' : `WordPress draft ${worksheet.pr_url}`}
          </a>
          {worksheet.applied_at ? ` on ${new Date(worksheet.applied_at).toLocaleDateString('en-GB')}` : ''}.
        </div>
      ) : null}

      {/* 1. Header numbers */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="os-card p-5">
          <p className="text-xs uppercase tracking-wide text-[color:var(--text-3)]">Clicks · 28 days</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[color:var(--text)]">
            {fmt(stats.clicks)}
            <Delta now={stats.clicks} prev={stats.prevClicks} />
          </p>
        </div>
        <div className="os-card p-5">
          <p className="text-xs uppercase tracking-wide text-[color:var(--text-3)]">Impressions · 28 days</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[color:var(--text)]">
            {fmt(stats.impressions)}
            <Delta now={stats.impressions} prev={stats.prevImpressions} />
          </p>
        </div>
        <div className="os-card p-5">
          <p className="text-xs uppercase tracking-wide text-[color:var(--text-3)]">Queries ranked for</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[color:var(--text)]">{stats.queries.length}</p>
          <p className="mt-1 text-xs text-[color:var(--text-3)]">avg position {stats.position ?? '—'}</p>
        </div>
        <div className="os-card p-5">
          <p className="text-xs uppercase tracking-wide text-[color:var(--text-3)]">Estimated upside</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-[color:var(--text)]">+{fmt(stats.estimatedUpside)} clicks/mo</p>
          <p className="mt-1 text-xs text-[color:var(--text-3)]" title={CTR_MODEL_LABEL}>
            if every 4-30 query reached position 3 — a model, not a measurement
          </p>
        </div>
      </div>

      {payload?.quality_score_note ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{payload.quality_score_note}</div>
      ) : null}

      {stats.queries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
          Search Console has no query data for this URL in the last 28 days. If the site was connected recently, the first sync backfills 90 days of query×page history overnight.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {/* 2. Opportunity table */}
        <div className="os-card p-6">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Opportunity — queries at positions 4-30</h2>
          <p className="mt-1 text-xs text-[color:var(--text-3)]">{CTR_MODEL_LABEL}</p>
          {stats.opportunities.length === 0 ? (
            <p className="mt-4 text-sm text-[color:var(--text-3)]">No queries in the 4-30 band.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-[color:var(--text-3)]">
                    <th className="py-2 pr-3 font-medium">Query</th>
                    <th className="py-2 pr-3 text-right font-medium">Impr.</th>
                    <th className="py-2 pr-3 text-right font-medium">Pos.</th>
                    <th className="py-2 text-right font-medium">+clicks/mo at 3</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.opportunities.slice(0, 40).map((q) => (
                    <tr key={q.query} className="border-b border-[color:var(--border)] last:border-0">
                      <td className="py-2 pr-3 text-[color:var(--text)]">{q.query}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{fmt(q.impressions)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{q.position}</td>
                      <td className="py-2 text-right tabular-nums text-[color:var(--text-2)]">+{q.upside}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 3. What the page has now */}
        <div className="os-card p-6">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">What the page has now</h2>
          {!payload ? (
            <p className="mt-3 text-sm text-[color:var(--text-3)]">Generate the worksheet to fetch the live title, meta and outline.</p>
          ) : !payload.page ? (
            <p className="mt-3 text-sm text-[color:var(--text-3)]">The page could not be fetched (blocked, timed out or not 200).</p>
          ) : (
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[color:var(--text-3)]">Title ({payload.page.title?.length ?? 0} chars)</dt>
                <dd className="text-[color:var(--text)]">{payload.page.title ?? <span className="text-red-600">missing</span>}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[color:var(--text-3)]">Meta description ({payload.page.meta_description?.length ?? 0} chars)</dt>
                <dd className="text-[color:var(--text-2)]">{payload.page.meta_description ?? <span className="text-red-600">missing</span>}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[color:var(--text-3)]">Outline · {payload.page.word_count.toLocaleString('en-GB')} words</dt>
                <dd>
                  <ul className="mt-1 space-y-0.5 text-[color:var(--text-2)]">
                    {payload.page.h1.map((h) => (
                      <li key={`h1-${h}`} className="font-medium text-[color:var(--text)]">
                        H1: {h}
                      </li>
                    ))}
                    {payload.page.headings.map((h, i) => (
                      <li key={`${h}-${i}`} className={h.startsWith('H3') ? 'pl-4 text-[color:var(--text-3)]' : ''}>
                        {h}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      {payload ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {/* 4. What the winners have */}
          <div className="os-card p-6">
            <h2 className="text-sm font-semibold text-[color:var(--text)]">
              What the winners have{payload.primary_query ? ` for “${payload.primary_query}”` : ''}
            </h2>
            {payload.serp_snapshot_status !== 'ready' ? (
              <p className="mt-3 text-sm text-[color:var(--text-3)]">
                {payload.serp_snapshot_status === 'queued'
                  ? 'A SERP snapshot for the primary query has been queued — regenerate in ~15 minutes to see the top-5 outlines.'
                  : 'No SERP snapshot for the primary query and none could be queued (is DataForSEO configured?).'}
              </p>
            ) : (
              <>
                {payload.gap_headings.length > 0 ? (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Content gap — on 3+ of the top 5, absent here</p>
                    <ul className="mt-2 space-y-1 text-sm text-amber-900">
                      {payload.gap_headings.map((h) => (
                        <li key={h}>• {h}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[color:var(--text-3)]">No heading appears on 3+ of the top 5 that this page lacks.</p>
                )}
                <ul className="mt-4 space-y-3">
                  {payload.winners.map((w) => (
                    <li key={w.url} className="text-sm">
                      <a href={w.url} target="_blank" rel="noreferrer" className="font-medium text-[color:var(--text)] underline decoration-[color:var(--border)] underline-offset-2">
                        {w.title ?? w.url}
                      </a>
                      <p className="mt-0.5 line-clamp-3 text-xs text-[color:var(--text-3)]">{w.headings.slice(0, 12).join(' · ')}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* 5. Unanswered questions */}
          <div className="os-card p-6">
            <h2 className="text-sm font-semibold text-[color:var(--text)]">Unanswered questions (People Also Ask)</h2>
            {payload.unanswered_questions.length === 0 ? (
              <p className="mt-3 text-sm text-[color:var(--text-3)]">
                {payload.serp_snapshot_status === 'ready' ? 'Every PAA question in the snapshot is addressed by a heading here.' : 'Needs the SERP snapshot.'}
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm text-[color:var(--text-2)]">
                {payload.unanswered_questions.map((q) => (
                  <li key={q}>• {q}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {/* 6. The change list */}
      {payload ? (
        <div className="os-card p-6">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Change list</h2>
          {!payload.change_list ? (
            <p className="mt-3 text-sm text-[color:var(--text-3)]">The model did not return a valid change list — regenerate.</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-[color:var(--text-3)]">
                Tick what you approve. Ticks persist. {site.cms_type === 'github' ? 'Approved title, meta and sections go into a pull request; links and removals stay manual.' : site.cms_type === 'wordpress' ? 'Approved items create a WordPress draft revision, never a live edit.' : 'Set a CMS in settings to apply these as a PR or draft.'}
              </p>
              <WorksheetChecklist siteId={site.id} encodedUrl={encodedUrl} items={items} checked={worksheet?.checked ?? {}} />
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
