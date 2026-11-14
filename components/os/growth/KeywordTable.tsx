'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { SeoCluster, SeoKeyword } from '@/lib/types'

/**
 * Keyword table (site overview + /keywords page). v2 columns: real KD with a
 * colour band, measured intent chip, target URL (the page GSC says owns the
 * query), SERP-observed position + AI Overview state, and modelled value where
 * paid data exists. Sortable; `full` mode adds the C4 filters.
 */

type SortKey =
  | 'keyword'
  | 'search_volume'
  | 'keyword_difficulty'
  | 'gsc_clicks'
  | 'gsc_impressions'
  | 'gsc_position'
  | 'commercial_value'

export interface SerpStateLite {
  our_position: number | null
  ai_overview: boolean
  ai_overview_cites_us: boolean
}

const COLUMNS: Array<{ key: SortKey; label: string; numeric?: boolean }> = [
  { key: 'keyword', label: 'Keyword' },
  { key: 'search_volume', label: 'Volume', numeric: true },
  { key: 'keyword_difficulty', label: 'KD', numeric: true },
  { key: 'gsc_clicks', label: 'Clicks', numeric: true },
  { key: 'gsc_impressions', label: 'Impressions', numeric: true },
  { key: 'gsc_position', label: 'Position', numeric: true },
]

const DISPLAY_CAP = 200

function isQuickWin(k: SeoKeyword): boolean {
  return k.gsc_position !== null && k.gsc_position >= 11 && k.gsc_position <= 20
}

function formatNumber(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : n.toLocaleString('en-GB')
}

export function kdBand(kd: number | null): { label: string; className: string } {
  if (kd === null) return { label: '—', className: 'text-[color:var(--text-3)]' }
  if (kd < 15) return { label: 'very easy', className: 'bg-[var(--emerald-dim)] text-[var(--emerald-strong)] border-[var(--emerald)]/40' }
  if (kd < 30) return { label: 'easy', className: 'bg-[var(--green-dim)] text-[var(--green-strong)] border-[var(--green)]/40' }
  if (kd < 50) return { label: 'medium', className: 'bg-[var(--amber-dim)] text-[var(--amber-strong)] border-[var(--amber)]/40' }
  if (kd < 70) return { label: 'hard', className: 'bg-[var(--amber-dim)] text-[var(--amber-strong)] border-[var(--amber)]/40' }
  return { label: 'very hard', className: 'bg-[var(--red-dim)] text-[var(--red-strong)] border-[var(--red)]/40' }
}

const INTENT_STYLE: Record<string, string> = {
  informational: 'bg-[var(--accent-dim)] text-[var(--accent-strong)] border-[var(--accent)]/40',
  commercial: 'bg-[var(--grey-dim)] text-[var(--grey-strong)] border-[var(--grey)]/40',
  transactional: 'bg-[var(--emerald-dim)] text-[var(--emerald-strong)] border-[var(--emerald)]/40',
  navigational: 'bg-[var(--surface)] text-[var(--text-2)] border-[var(--border)]',
}

function pathOf(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname === '/' ? '/' : u.pathname
  } catch {
    return url
  }
}

function encodeUrl(url: string): string {
  return btoa(unescape(encodeURIComponent(url))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export default function KeywordTable({
  keywords,
  clusters,
  siteId,
  serpStates,
  pagesPerQuery,
  full = false,
  initialFilters,
}: {
  keywords: SeoKeyword[]
  clusters: SeoCluster[]
  siteId?: string
  serpStates?: Record<string, SerpStateLite>
  /** Number of pages holding each query over 28 days (C4). */
  pagesPerQuery?: Record<string, number>
  full?: boolean
  initialFilters?: { band?: string; target?: string; q?: string; source?: string }
}) {
  const hasPaid = keywords.some((k) => k.commercial_value !== null && k.commercial_value !== undefined)
  const [sortKey, setSortKey] = useState<SortKey>(hasPaid ? 'commercial_value' : 'gsc_clicks')
  const [sortAsc, setSortAsc] = useState(false)
  const [clusterFilter, setClusterFilter] = useState('')
  const [intentFilter, setIntentFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState(initialFilters?.source ?? '')
  const [bandFilter, setBandFilter] = useState(initialFilters?.band ?? '')
  const [kdMax, setKdMax] = useState('')
  const [volumeMin, setVolumeMin] = useState('')
  const [targetFilter, setTargetFilter] = useState(initialFilters?.target ?? '')
  const [search, setSearch] = useState(initialFilters?.q ?? '')

  const clusterNames = useMemo(() => new Map(clusters.map((c) => [c.id, c.name])), [clusters])
  const intents = useMemo(
    () => [...new Set(keywords.map((k) => k.intent).filter((i): i is string => Boolean(i)))].sort(),
    [keywords]
  )
  const sources = useMemo(() => [...new Set(keywords.map((k) => k.source))].sort(), [keywords])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const rows = keywords.filter((k) => {
      if (clusterFilter === 'none' && k.cluster_id) return false
      if (clusterFilter && clusterFilter !== 'none' && k.cluster_id !== clusterFilter) return false
      if (intentFilter && k.intent !== intentFilter) return false
      if (sourceFilter && k.source !== sourceFilter) return false
      if (kdMax && (k.keyword_difficulty === null || k.keyword_difficulty > Number(kdMax))) return false
      if (volumeMin && (k.search_volume === null || k.search_volume < Number(volumeMin))) return false
      if (bandFilter) {
        const [lo, hi] = bandFilter.split('-').map(Number)
        if (k.gsc_position === null || k.gsc_position < lo || k.gsc_position > hi) return false
      }
      if (targetFilter === 'none' && k.ranking_url) return false
      if (targetFilter === 'one' && !k.ranking_url) return false
      if (targetFilter === 'multi' && (pagesPerQuery?.[k.keyword] ?? 0) < 2) return false
      if (needle && !k.keyword.includes(needle)) return false
      return true
    })
    const dir = sortAsc ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir
      return ((av as number) - (bv as number)) * dir
    })
  }, [keywords, clusterFilter, intentFilter, sourceFilter, kdMax, volumeMin, bandFilter, targetFilter, search, sortKey, sortAsc, pagesPerQuery])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc((v) => !v)
    } else {
      setSortKey(key)
      setSortAsc(key === 'keyword' || key === 'gsc_position' || key === 'keyword_difficulty')
    }
  }

  const shown = filtered.slice(0, DISPLAY_CAP)
  const inputClass =
    'os-input px-3 py-2 text-sm'

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter keywords…"
          className={`${inputClass} grow`}
        />
        <select value={clusterFilter} onChange={(e) => setClusterFilter(e.target.value)} className={inputClass}>
          <option value="">All clusters</option>
          <option value="none">Unclustered</option>
          {clusters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={intentFilter} onChange={(e) => setIntentFilter(e.target.value)} className={inputClass}>
          <option value="">All intents</option>
          {intents.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        {full ? (
          <>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={inputClass}>
              <option value="">All sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <select value={bandFilter} onChange={(e) => setBandFilter(e.target.value)} className={inputClass}>
              <option value="">Any position</option>
              <option value="1-3">Top 3</option>
              <option value="4-10">4-10</option>
              <option value="11-20">11-20 (quick wins)</option>
              <option value="21-50">21-50</option>
            </select>
            <select value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)} className={inputClass}>
              <option value="">Any target URL</option>
              <option value="none">No page targets it (backlog)</option>
              <option value="one">Has a target page</option>
              <option value="multi">Two+ pages (cannibalisation)</option>
            </select>
            <input value={kdMax} onChange={(e) => setKdMax(e.target.value)} placeholder="KD ≤" inputMode="numeric" className={`${inputClass} w-20`} />
            <input value={volumeMin} onChange={(e) => setVolumeMin(e.target.value)} placeholder="Vol ≥" inputMode="numeric" className={`${inputClass} w-20`} />
          </>
        ) : null}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="os-label border-b border-[color:var(--border)]">
              {COLUMNS.map((col) => (
                <th key={col.key} className={`py-2 pr-4 font-semibold ${col.numeric ? 'text-right' : ''}`}>
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="inline-flex items-center gap-1 uppercase hover:text-[color:var(--text)]"
                  >
                    {col.label}
                    {sortKey === col.key ? <span aria-hidden="true">{sortAsc ? '↑' : '↓'}</span> : null}
                  </button>
                </th>
              ))}
              {hasPaid ? (
                <th className="py-2 pr-4 text-right font-semibold">
                  <button type="button" onClick={() => toggleSort('commercial_value')} className="inline-flex items-center gap-1 uppercase hover:text-[color:var(--text)]" title="Ads conversion value attributed to this query — your data, not a model">
                    Value {sortKey === 'commercial_value' ? <span aria-hidden="true">{sortAsc ? '↑' : '↓'}</span> : null}
                  </button>
                </th>
              ) : null}
              {serpStates ? <th className="py-2 pr-4 font-semibold">SERP</th> : null}
              <th className="py-2 pr-4 font-semibold">Target URL</th>
              <th className="py-2 font-semibold">Cluster</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((k) => {
              const band = kdBand(k.keyword_difficulty)
              const state = serpStates?.[k.id]
              const pages = pagesPerQuery?.[k.keyword] ?? (k.ranking_url ? 1 : 0)
              return (
                <tr
                  key={k.id}
                  className={`border-b border-[color:var(--border)] last:border-0 ${isQuickWin(k) ? 'bg-[var(--amber-dim)]' : ''}`}
                >
                  <td className="py-2.5 pr-4 text-[color:var(--text)]">
                    <span>{k.keyword}</span>
                    {k.intent ? (
                      <span
                        className={`ml-2 rounded-pill border px-2 py-0.5 text-[10px] font-medium ${INTENT_STYLE[k.intent] ?? 'border-[color:var(--border)] text-[color:var(--text-3)]'}`}
                        title={k.intent_source === 'dataforseo' ? `Measured intent${k.intent_confidence ? ` (${Math.round(k.intent_confidence * 100)}%)` : ''}` : 'Model-guessed intent'}
                      >
                        {k.intent}
                        {k.intent_source !== 'dataforseo' ? '?' : ''}
                      </span>
                    ) : null}
                    {isQuickWin(k) ? (
                      <span className="ml-2 rounded-pill border border-[var(--amber)]/40 bg-[var(--amber-dim)] px-2 py-0.5 text-[10px] font-medium text-[var(--amber-strong)]">
                        quick win
                      </span>
                    ) : null}
                    {k.source === 'google_ads' ? (
                      <span className="ml-2 rounded-pill border border-[var(--grey)]/40 bg-[var(--grey-dim)] px-2 py-0.5 text-[10px] font-medium text-[var(--grey-strong)]" title="Converting Google Ads search term with no organic page">
                        from ads
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-[color:var(--text-2)]">{formatNumber(k.search_volume)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {k.keyword_difficulty === null ? (
                      <span className="text-[color:var(--text-3)]" title={k.ads_competition !== null ? `Not enriched yet. Ads competition ${k.ads_competition} (paid, not organic difficulty)` : 'Not enriched yet'}>
                        —
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[11px] font-medium ${band.className}`} title={band.label}>
                        {k.keyword_difficulty}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-[color:var(--text-2)]">{formatNumber(k.gsc_clicks)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-[color:var(--text-2)]">{formatNumber(k.gsc_impressions)}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-[color:var(--text-2)]" title="Search Console average position (impression-weighted)">
                    {k.gsc_position ?? '—'}
                  </td>
                  {hasPaid ? (
                    <td className="py-2.5 pr-4 text-right tabular-nums text-[color:var(--text-2)]">
                      {k.commercial_value !== null && k.commercial_value !== undefined ? (
                        <span title={`${k.conversions_per_1000_impressions ?? '—'} conv/1000 impr · ${k.value_per_click ?? '—'} per click (Ads data)`}>
                          {Math.round(k.commercial_value).toLocaleString('en-GB')}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  ) : null}
                  {serpStates ? (
                    <td className="py-2.5 pr-4 text-xs text-[color:var(--text-2)]">
                      {state ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="tabular-nums" title="Observed position in the latest SERP snapshot (a single observation; GSC position is the average)">
                            {state.our_position ?? 'n/r'}
                          </span>
                          {state.ai_overview ? (
                            <span
                              className={`rounded-pill border px-1.5 py-0.5 text-[10px] font-medium ${state.ai_overview_cites_us ? 'border-[var(--emerald)]/40 bg-[var(--emerald-dim)] text-[var(--emerald-strong)]' : 'border-[var(--border-light)] bg-[var(--surface-2)] text-[var(--text)]'}`}
                              title={state.ai_overview_cites_us ? 'AI Overview present and cites this site' : 'AI Overview present, does not cite this site'}
                            >
                              AIO{state.ai_overview_cites_us ? ' ✓' : ''}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-[color:var(--text-3)]">—</span>
                      )}
                    </td>
                  ) : null}
                  <td className="py-2.5 pr-4 text-xs">
                    {k.ranking_url && siteId ? (
                      <Link
                        href={`/growth/${siteId}/pages/${encodeUrl(k.ranking_url)}`}
                        className="text-[color:var(--accent-strong)] underline decoration-[color:var(--border)] underline-offset-2 hover:decoration-current"
                        title={`${k.ranking_url} — ${formatNumber(k.ranking_url_impressions)} impressions, position ${k.ranking_url_position ?? '—'} (28d)`}
                      >
                        {pathOf(k.ranking_url)}
                      </Link>
                    ) : k.ranking_url ? (
                      <span className="text-[color:var(--text-2)]">{pathOf(k.ranking_url)}</span>
                    ) : k.ranking_url_checked_at ? (
                      <span className="text-[color:var(--text-3)]" title="Impressions but no page owns this query">
                        no page
                      </span>
                    ) : (
                      <span className="text-[color:var(--text-3)]">—</span>
                    )}
                    {pages >= 2 ? (
                      <span className="ml-1 rounded-pill border border-[var(--red)]/40 bg-[var(--red-dim)] px-1.5 py-0.5 text-[10px] text-[var(--red-strong)]" title={`${pages} pages hold impressions for this query`}>
                        {pages} pages
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 text-[color:var(--text-3)]">{k.cluster_id ? clusterNames.get(k.cluster_id) ?? '—' : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length > DISPLAY_CAP ? (
          <p className="mt-2 text-xs text-[color:var(--text-3)]">
            Showing {DISPLAY_CAP} of {filtered.length} — narrow the filters to see the rest.
          </p>
        ) : null}
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-[color:var(--text-3)]">No keywords match these filters.</p>
        ) : null}
        <p className="mt-2 text-[11px] text-[color:var(--text-3)]">
          KD is organic keyword difficulty from DataForSEO Labs (0-14 very easy · 15-29 easy · 30-49 medium · 50-69 hard · 70+ very hard). Intent marked “?” was guessed by the model, not measured.
          {hasPaid ? ' Value = Google Ads conversion value attributed to the query over the sync window; rows without it have no paid data.' : ''}
        </p>
      </div>
    </div>
  )
}
