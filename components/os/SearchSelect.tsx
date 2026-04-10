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
      {label ? <span className="text-sm text-[#9CA3AF]">{label}</span> : null}
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-2xl border border-[#2A2A3A] bg-[#13131E] px-4 py-3 text-sm text-white placeholder:text-[#9CA3AF]/60 disabled:opacity-60"
      />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-2xl border border-[#2A2A3A] bg-[#13131E] px-4 py-3 text-sm text-white disabled:opacity-60"
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
