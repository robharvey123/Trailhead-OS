'use client'

import { useMemo, useState } from 'react'
import { labelColor } from '@/lib/tags'

/**
 * Multi-select label picker seeded from labels already present in the project.
 * Pick from the existing set with a text filter; typing a label not in the set
 * lets you create it (label creation has only ever been free-text here, so we
 * keep that capability rather than locking out new labels).
 */
export default function LabelPicker({
  available,
  selected,
  onChange,
}: {
  available: string[]
  selected: string[]
  onChange: (labels: string[]) => void
}) {
  const [query, setQuery] = useState('')

  const input =
    'w-full rounded-control border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'

  function add(raw: string) {
    const l = raw.trim()
    if (!l || selected.some((x) => x.toLowerCase() === l.toLowerCase())) {
      setQuery('')
      return
    }
    onChange([...selected, l])
    setQuery('')
  }

  function remove(label: string) {
    onChange(selected.filter((x) => x !== label))
  }

  const q = query.trim().toLowerCase()
  const suggestions = useMemo(
    () => available.filter((l) => !selected.includes(l) && (!q || l.toLowerCase().includes(q))),
    [available, selected, q]
  )
  const canCreate =
    q.length > 0 &&
    !available.some((l) => l.toLowerCase() === q) &&
    !selected.some((l) => l.toLowerCase() === q)

  function chip(l: string, opts: { active: boolean; onClick: () => void; title?: string }) {
    const c = labelColor(l)
    return (
      <button
        key={l}
        type="button"
        onClick={opts.onClick}
        title={opts.title}
        className="inline-flex max-w-[200px] cursor-pointer items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap rounded-pill border px-[9px] py-[3px] text-[11px] font-semibold"
        // The hue is derived from the label text, so it stays inline. A selected
        // chip keeps the label's ink on a deeper tint with an ink border: white
        // type on the solid hue fails contrast for the lighter hues.
        style={{
          background: opts.active ? `hsl(${c.hue} 70% 50% / 0.3)` : c.bg,
          color: c.fg,
          borderColor: opts.active ? c.fg : c.border,
        }}
      >
        {opts.active ? `${l} ✕` : l}
      </button>
    )
  }

  return (
    <div className="grid gap-2">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((l) => chip(l, { active: true, onClick: () => remove(l), title: `Remove ${l}` }))}
        </div>
      ) : null}

      <input
        className={input}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (suggestions.length === 1) add(suggestions[0])
            else if (canCreate) add(query)
          }
        }}
        placeholder={available.length > 0 ? 'Filter or add a label…' : 'Add a label…'}
      />

      {suggestions.length > 0 || canCreate ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((l) => chip(l, { active: false, onClick: () => add(l), title: `Add ${l}` }))}
          {canCreate ? (
            <button
              type="button"
              onClick={() => add(query)}
              className="cursor-pointer rounded-pill border border-dashed border-[var(--border)] bg-transparent px-[9px] py-[3px] text-[11px] font-semibold text-[var(--text-3)]"
            >
              + Create “{query.trim()}”
            </button>
          ) : null}
        </div>
      ) : (
        <p className="m-0 text-[11px] text-[var(--text-3)]">
          {available.length === 0 ? 'No labels in this project yet — type to add one.' : 'No matching labels.'}
        </p>
      )}
    </div>
  )
}
