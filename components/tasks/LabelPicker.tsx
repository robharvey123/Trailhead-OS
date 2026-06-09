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
    'w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'

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
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 600,
          padding: '3px 9px',
          borderRadius: 999,
          cursor: 'pointer',
          background: opts.active ? c.solidBg : c.bg,
          color: opts.active ? '#fff' : c.fg,
          border: `1px solid ${opts.active ? c.solidBg : c.border}`,
          maxWidth: 200,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {opts.active ? `${l} ✕` : l}
      </button>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {selected.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {suggestions.map((l) => chip(l, { active: false, onClick: () => add(l), title: `Add ${l}` }))}
          {canCreate ? (
            <button
              type="button"
              onClick={() => add(query)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: 999,
                cursor: 'pointer',
                background: 'transparent',
                color: 'var(--text-3)',
                border: '1px dashed var(--border)',
              }}
            >
              + Create “{query.trim()}”
            </button>
          ) : null}
        </div>
      ) : (
        <p style={{ color: 'var(--text-3)', fontSize: 11, margin: 0 }}>
          {available.length === 0 ? 'No labels in this project yet — type to add one.' : 'No matching labels.'}
        </p>
      )}
    </div>
  )
}
