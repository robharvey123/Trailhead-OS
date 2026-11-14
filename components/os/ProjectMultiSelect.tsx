'use client'

import { useMemo, useState } from 'react'

interface ProjectOption {
  id: string
  name: string
}

interface ProjectMultiSelectProps {
  label: string
  options: ProjectOption[]
  /** Selected project ids. */
  value: string[]
  onChange: (ids: string[]) => void
}

const labelClass =
  'field-label block'

export default function ProjectMultiSelect({ label, options, value, onChange }: ProjectMultiSelectProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options])

  const available = useMemo(() => {
    const term = query.trim().toLowerCase()
    return options
      .filter((o) => !value.includes(o.id))
      .filter((o) => (term ? o.name.toLowerCase().includes(term) : true))
      .slice(0, 20)
  }, [options, value, query])

  function add(id: string) {
    onChange([...value, id])
    setQuery('')
  }

  function remove(id: string) {
    onChange(value.filter((v) => v !== id))
  }

  return (
    <div>
      <label className={labelClass}>{label}</label>

      {value.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-pill bg-[var(--accent-dim)] px-2.5 py-1 text-xs font-medium text-[color:var(--accent-strong)]"
            >
              {byId.get(id)?.name ?? 'Unknown project'}
              <button
                type="button"
                onClick={() => remove(id)}
                className="text-[color:var(--accent-strong)] hover:opacity-70"
                aria-label="Remove project"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <input
          className="os-input w-full px-3 py-2 text-sm"
          value={query}
          placeholder={options.length === 0 ? 'No projects available' : 'Add a project…'}
          disabled={options.length === 0}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
        />

        {open && available.length > 0 ? (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-card border border-[color:var(--border)] bg-[var(--bg)] shadow-[var(--shadow-lg)]">
            {available.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(option.id)}
                className="block w-full px-3 py-2 text-left text-sm text-[color:var(--text)] hover:bg-[var(--surface-2)]"
              >
                {option.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
