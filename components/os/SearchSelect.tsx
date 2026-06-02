'use client'

import { useMemo, useState } from 'react'

export interface SearchSelectOption {
  value: string
  label: string
  meta?: string | null
}

interface SearchSelectProps {
  label: string
  value: string
  options: SearchSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  emptyLabel?: string
  disabled?: boolean
  maxVisibleOptions?: number
}

export default function SearchSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Search...',
  emptyLabel = 'None',
  disabled = false,
  maxVisibleOptions,
}: SearchSelectProps) {
  const [query, setQuery] = useState('')

  const filteredOptions = useMemo(() => {
    const search = query.trim().toLowerCase()
    const matches = !search
      ? options
      : options.filter((option) => {
      const haystack = `${option.label} ${option.meta ?? ''}`.toLowerCase()
      return haystack.includes(search)
        })

    return typeof maxVisibleOptions === 'number' && maxVisibleOptions > 0
      ? matches.slice(0, maxVisibleOptions)
      : matches
  }, [maxVisibleOptions, options, query])

  return (
    <label className="space-y-2">
      {label ? <span className="text-sm text-[color:var(--text-2)]">{label}</span> : null}
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-3)] disabled:opacity-50"
      />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[color:var(--text)] disabled:opacity-50"
      >
        <option value="">{emptyLabel}</option>
        {filteredOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.meta ? `${option.label} — ${option.meta}` : option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
