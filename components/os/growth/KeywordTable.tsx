'use client'

import { useMemo, useState } from 'react'
import type { SeoCluster, SeoKeyword } from '@/lib/types'

type SortKey = 'keyword' | 'search_volume' | 'difficulty' | 'gsc_clicks' | 'gsc_impressions' | 'gsc_position'

const COLUMNS: Array<{ key: SortKey; label: string; numeric?: boolean }> = [
  { key: 'keyword', label: 'Keyword' },
  { key: 'search_volume', label: 'Volume', numeric: true },
  { key: 'difficulty', label: 'Difficulty', numeric: true },
  { key: 'gsc_clicks', label: 'Clicks', numeric: true },
  { key: 'gsc_impressions', label: 'Impressions', numeric: true },
  { key: 'gsc_position', label: 'Position', numeric: true },
]

const DISPLAY_CAP = 200

function isQuickWin(k: SeoKeyword): boolean {
  return k.gsc_position !== null && k.gsc_position >= 11 && k.gsc_position <= 20
}

function formatNumber(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('en-GB')
}

export default function KeywordTable({
  keywords,
  clusters,
}: {
  keywords: SeoKeyword[]
  clusters: SeoCluster[]
}) {
  const [sortKey, setSortKey] = useState<SortKey>('gsc_clicks')
  const [sortAsc, setSortAsc] = useState(false)
  const [clusterFilter, setClusterFilter] = useState('')
  const [intentFilter, setIntentFilter] = useState('')
  const [search, setSearch] = useState('')

  const clusterNames = useMemo(
    () => new Map(clusters.map((c) => [c.id, c.name])),
    [clusters]
  )
  const intents = useMemo(
    () => [...new Set(keywords.map((k) => k.intent).filter((i): i is string => Boolean(i)))].sort(),
    [keywords]
  )

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const rows = keywords.filter((k) => {
      if (clusterFilter === 'none' && k.cluster_id) return false
      if (clusterFilter && clusterFilter !== 'none' && k.cluster_id !== clusterFilter) return false
      if (intentFilter && k.intent !== intentFilter) return false
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
  }, [keywords, clusterFilter, intentFilter, search, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc((v) => !v)
    } else {
      setSortKey(key)
      // Position reads best ascending (1 is good); counts read best descending.
      setSortAsc(key === 'keyword' || key === 'gsc_position')
    }
  }

  const shown = filtered.slice(0, DISPLAY_CAP)

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter keywords…"
          className="grow rounded-2xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-3)] focus:border-[color:var(--accent)] focus:outline-none"
        />
        <select
          value={clusterFilter}
          onChange={(e) => setClusterFilter(e.target.value)}
          className="rounded-2xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-2)] focus:border-[color:var(--accent)] focus:outline-none"
        >
          <option value="">All clusters</option>
          <option value="none">Unclustered</option>
          {clusters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={intentFilter}
          onChange={(e) => setIntentFilter(e.target.value)}
          className="rounded-2xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-2)] focus:border-[color:var(--accent)] focus:outline-none"
        >
          <option value="">All intents</option>
          {intents.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-[color:var(--text-3)]">
              {COLUMNS.map((col) => (
                <th key={col.key} className={`py-2 pr-4 font-medium ${col.numeric ? 'text-right' : ''}`}>
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-[color:var(--text)]"
                  >
                    {col.label}
                    {sortKey === col.key ? <span aria-hidden="true">{sortAsc ? '↑' : '↓'}</span> : null}
                  </button>
                </th>
              ))}
              <th className="py-2 font-medium">Cluster</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((k) => (
              <tr
                key={k.id}
                className={`border-b border-[color:var(--border)] last:border-0 ${
                  isQuickWin(k) ? 'bg-amber-50/60' : ''
                }`}
              >
                <td className="py-2.5 pr-4 text-[color:var(--text)]">
                  {k.keyword}
                  {isQuickWin(k) ? (
                    <span className="ml-2 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      quick win
                    </span>
                  ) : null}
                </td>
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
                <td className="py-2.5 pr-4 text-right tabular-nums text-[color:var(--text-2)]">
                  {k.gsc_position ?? '—'}
                </td>
                <td className="py-2.5 text-[color:var(--text-3)]">
                  {k.cluster_id ? clusterNames.get(k.cluster_id) ?? '—' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > DISPLAY_CAP ? (
          <p className="mt-2 text-xs text-[color:var(--text-3)]">
            Showing {DISPLAY_CAP} of {filtered.length} — narrow the filters to see the rest.
          </p>
        ) : null}
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-[color:var(--text-3)]">
            No keywords match these filters.
          </p>
        ) : null}
      </div>
    </div>
  )
}
