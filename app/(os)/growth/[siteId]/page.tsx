import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSeoKeywords, getSeoSiteById } from '@/lib/db/growth'
import { createClient } from '@/lib/supabase/server'
import { researchKeywordsAction, syncGscNowAction } from '../actions'

function formatNumber(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('en-GB')
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
  const keywords = await getSeoKeywords(siteId, supabase)

  const syncAction = syncGscNowAction.bind(null, site.id)
  const researchAction = researchKeywordsAction.bind(null, site.id)
  // Positions 11-20 are page-two rankings — the cheapest wins available.
  const quickWins = keywords.filter(
    (k) => k.gsc_position !== null && k.gsc_position >= 11 && k.gsc_position <= 20
  ).length

  return (
    <div className="space-y-6">
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
            {site.gsc_property ? ` · ${site.gsc_property}` : ' · no GSC property configured'}
            {site.last_gsc_sync_at
              ? ` · synced ${new Date(site.last_gsc_sync_at).toLocaleString('en-GB')}`
              : ''}
          </p>
        </div>
        {site.gsc_property ? (
          <form action={syncAction}>
            <button
              type="submit"
              className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)]"
            >
              Sync GSC now
            </button>
          </form>
        ) : null}
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

      <div className="os-card p-6">
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
          <button
            type="submit"
            className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
          >
            Queue research
          </button>
        </form>
      </div>

      <div className="os-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">
            Keywords ({keywords.length})
          </h2>
          {quickWins > 0 ? (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              {quickWins} quick wins at position 11-20
            </span>
          ) : null}
        </div>
        {keywords.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
            No keywords yet. Sync GSC or queue keyword research above.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-[color:var(--text-3)]">
                  <th className="py-2 pr-4 font-medium">Keyword</th>
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 text-right font-medium">Volume</th>
                  <th className="py-2 pr-4 text-right font-medium">Difficulty</th>
                  <th className="py-2 pr-4 text-right font-medium">Clicks</th>
                  <th className="py-2 pr-4 text-right font-medium">Impressions</th>
                  <th className="py-2 text-right font-medium">Position</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((k) => {
                  const isQuickWin =
                    k.gsc_position !== null && k.gsc_position >= 11 && k.gsc_position <= 20
                  return (
                    <tr
                      key={k.id}
                      className={`border-b border-[color:var(--border)] last:border-0 ${
                        isQuickWin ? 'bg-amber-50/60' : ''
                      }`}
                    >
                      <td className="py-2.5 pr-4 text-[color:var(--text)]">{k.keyword}</td>
                      <td className="py-2.5 pr-4 text-[color:var(--text-3)]">{k.source}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-[color:var(--text-2)]">
                        {formatNumber(k.search_volume)}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-[color:var(--text-2)]">
                        {formatNumber(k.difficulty)}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-[color:var(--text-2)]">
                        {formatNumber(k.gsc_clicks)}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-[color:var(--text-2)]">
                        {formatNumber(k.gsc_impressions)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-[color:var(--text-2)]">
                        {k.gsc_position ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
