'use client'

import { useMemo, useState } from 'react'
import { PendingButton } from '@/components/growth/PendingButton'
import { addGapKeywordsAction } from '@/app/(os)/growth/actions'
import type { GapKeyword } from '@/lib/growth/competitors'
import { kdBand } from '@/components/os/growth/KeywordTable'

export default function GapTable({ siteId, rows }: { siteId: string; rows: GapKeyword[] }) {
  const [kdMax, setKdMax] = useState('')
  const [minCompetitors, setMinCompetitors] = useState('1')
  const [hideKnown, setHideKnown] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => !kdMax || (r.keyword_difficulty !== null && r.keyword_difficulty <= Number(kdMax)))
        .filter((r) => r.competitors.length >= Number(minCompetitors))
        .filter((r) => !hideKnown || !r.in_keyword_list)
        .sort((a, b) => (b.search_volume ?? 0) - (a.search_volume ?? 0))
        .slice(0, 300),
    [rows, kdMax, minCompetitors, hideKnown]
  )
  const inputClass =
    'rounded-2xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-2)] focus:border-[color:var(--accent)] focus:outline-none'
  const toggle = (k: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  return (
    <form action={addGapKeywordsAction.bind(null, siteId)}>
      <div className="flex flex-wrap items-center gap-2">
        <input value={kdMax} onChange={(e) => setKdMax(e.target.value)} placeholder="KD ≤" inputMode="numeric" className={`${inputClass} w-20`} />
        <select value={minCompetitors} onChange={(e) => setMinCompetitors(e.target.value)} className={inputClass}>
          <option value="1">1+ competitor</option>
          <option value="2">2+ competitors</option>
          <option value="3">3+ competitors</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-[color:var(--text-2)]">
          <input type="checkbox" checked={hideKnown} onChange={(e) => setHideKnown(e.target.checked)} className="accent-[var(--accent)]" />
          Hide keywords already in the list
        </label>
        <span className="grow" />
        <button type="button" onClick={() => setSelected(new Set(filtered.map((r) => r.keyword)))} className="text-xs text-[color:var(--text-3)] underline">
          Select all shown
        </button>
        <PendingButton variant="primary" pendingLabel="Adding…">
          Add {selected.size} to keyword list
        </PendingButton>
      </div>
      {[...selected].map((k) => (
        <input key={k} type="hidden" name="keyword" value={k} />
      ))}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-[color:var(--text-3)]">
              <th className="py-2 pr-2" />
              <th className="py-2 pr-3 font-medium">Keyword</th>
              <th className="py-2 pr-3 text-right font-medium">Volume</th>
              <th className="py-2 pr-3 text-right font-medium">KD</th>
              <th className="py-2 pr-3 text-right font-medium">CPC</th>
              <th className="py-2 pr-3 text-right font-medium">Us</th>
              <th className="py-2 font-medium">Competitors ranking (position)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const band = kdBand(r.keyword_difficulty)
              return (
                <tr key={r.keyword} className="border-b border-[color:var(--border)] last:border-0">
                  <td className="py-2 pr-2">
                    <input type="checkbox" checked={selected.has(r.keyword)} onChange={() => toggle(r.keyword)} className="accent-[var(--accent)]" />
                  </td>
                  <td className="py-2 pr-3 text-[color:var(--text)]">
                    {r.keyword}
                    {r.in_keyword_list ? <span className="ml-2 text-[10px] text-[color:var(--text-3)]">in list</span> : null}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{r.search_volume?.toLocaleString('en-GB') ?? '—'}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {r.keyword_difficulty === null ? '—' : <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${band.className}`}>{r.keyword_difficulty}</span>}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-2)]">{r.cpc ?? '—'}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[color:var(--text-3)]">{r.our_position ?? 'n/r'}</td>
                  <td className="py-2 text-xs text-[color:var(--text-2)]">
                    {r.competitors
                      .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
                      .map((c) => `${c.domain} (${c.position ?? '?'})`)
                      .join(' · ')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className="py-6 text-center text-sm text-[color:var(--text-3)]">No gap keywords match these filters.</p> : null}
      </div>
    </form>
  )
}
