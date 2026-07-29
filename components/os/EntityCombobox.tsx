'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { crmNormaliseName } from '@/lib/crm/normalise'

export type EntityKind = 'account' | 'contact' | 'project' | 'engagement'

export interface EntityOption {
  id: string
  label: string
  meta?: string
}

interface EntityComboboxProps {
  label: string
  /** Selected id, '' when none. */
  value: string
  /** Current selection's label, shown without a round-trip. */
  selectedLabel?: string
  entity: EntityKind
  onChange: (opt: EntityOption) => void
  /** Create-inline footer. Defaults to true for account/contact, false otherwise. */
  allowCreate?: boolean
  /** Extra query params, e.g. { account_id } to scope a contact picker. */
  filters?: Record<string, string>
  disabled?: boolean
  /** Render an × to unset the value. */
  clearable?: boolean
  placeholder?: string
}

// Endpoint + response-shape map lives here, not in the callers.
const ENDPOINTS: Record<EntityKind, { list: string; create: string | null; key: string; createKey: string }> = {
  account: { list: '/api/accounts', create: '/api/accounts', key: 'accounts', createKey: 'account' },
  contact: { list: '/api/contacts', create: '/api/contacts', key: 'contacts', createKey: 'contact' },
  project: { list: '/api/projects', create: null, key: 'projects', createKey: 'project' },
  engagement: { list: '/api/engagements', create: null, key: 'engagements', createKey: 'engagement' },
}

const CREATE_DEFAULT: Record<EntityKind, boolean> = { account: true, contact: true, project: false, engagement: false }

type Row = Record<string, unknown>

function toOption(entity: EntityKind, row: Row): EntityOption {
  const id = String(row.id)
  const label = String(row.name ?? row.title ?? id)
  let meta: string | undefined
  if (entity === 'account') meta = (row.website as string) || (row.industry as string) || undefined
  else if (entity === 'contact') meta = [row.company, row.email].filter(Boolean).join(' · ') || undefined
  else if (entity === 'engagement') meta = (row.code as string) || undefined
  else if (entity === 'project') meta = (row.status as string) || undefined
  return { id, label, meta: meta || undefined }
}

const inputClass =
  'w-full rounded-xl border border-[color:var(--border)] bg-[var(--surface-2)] px-3 py-2 pr-8 text-sm text-[color:var(--text)] placeholder-[color:var(--text-3)] focus:border-[color:var(--accent)] focus:outline-none disabled:opacity-50'
const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-[color:var(--text-2)]'

export default function EntityCombobox({
  label,
  value,
  selectedLabel,
  entity,
  onChange,
  allowCreate,
  filters,
  disabled = false,
  clearable = false,
  placeholder,
}: EntityComboboxProps) {
  const cfg = ENDPOINTS[entity]
  const canCreate = (allowCreate ?? CREATE_DEFAULT[entity]) && Boolean(cfg.create)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EntityOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  // Read filters via a ref so a fresh inline object each render doesn't churn the
  // search effect; filterKey (a stable string) is what actually triggers a re-run.
  const filterKey = filters ? JSON.stringify(filters) : ''
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  // Debounced server-side search. Empty query returns the recent 10.
  useEffect(() => {
    if (!open || disabled) return
    const term = query.trim()
    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (term) params.set('search', term)
        params.set('limit', '20')
        const f = filtersRef.current
        if (f) for (const [k, v] of Object.entries(f)) if (v) params.set(k, v)
        const data = await apiFetch<Record<string, Row[]>>(`${cfg.list}?${params.toString()}`)
        const rows = (data[cfg.key] ?? []) as Row[]
        setResults(rows.slice(0, term ? 20 : 10).map((r) => toOption(entity, r)))
        setHighlight(0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(handle)
  }, [query, open, disabled, entity, cfg.list, cfg.key, filterKey])

  // Close on outside click.
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const term = query.trim()
  const exactMatch = results.some((r) => r.label.toLowerCase() === term.toLowerCase())
  const showCreate = canCreate && Boolean(term) && !exactMatch
  // A near-duplicate: a result whose normalised name equals the typed one (but not
  // an exact string match). Nudge "link instead?" before offering to create.
  const normalisedDupe = useMemo(() => {
    if (!showCreate || (entity !== 'account' && entity !== 'contact')) return undefined
    const n = crmNormaliseName(term)
    return n ? results.find((r) => crmNormaliseName(r.label) === n) : undefined
  }, [showCreate, entity, term, results])
  // Navigable items: the results plus, when shown, the create row (last index).
  const itemCount = results.length + (showCreate ? 1 : 0)

  function select(opt: EntityOption) {
    onChange(opt)
    setOpen(false)
    setQuery('')
    setError('')
  }

  async function createRecord() {
    if (!term || creating || !cfg.create) return
    setCreating(true)
    setError('')
    try {
      const data = await apiFetch<Record<string, Row>>(cfg.create, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: term }),
      })
      const row = data[cfg.createKey] as Row | undefined
      if (!row?.id) throw new Error('Create failed')
      select(toOption(entity, row))
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to create ${entity}`)
    } finally {
      setCreating(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); e.preventDefault() }
      return
    }
    if (e.key === 'ArrowDown') { setHighlight((h) => Math.min(h + 1, Math.max(0, itemCount - 1))); e.preventDefault() }
    else if (e.key === 'ArrowUp') { setHighlight((h) => Math.max(h - 1, 0)); e.preventDefault() }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlight < results.length) select(results[highlight])
      else if (showCreate) void createRecord()
    } else if (e.key === 'Escape') { setOpen(false) }
  }

  const activeId = useMemo(() => (highlight < results.length ? `${listId}-opt-${highlight}` : showCreate && highlight === results.length ? `${listId}-create` : undefined), [highlight, results.length, showCreate, listId])

  return (
    <div ref={containerRef} className="relative">
      <label className={labelClass}>{label}</label>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        disabled={disabled}
        className={inputClass}
        value={open ? query : selectedLabel ?? ''}
        placeholder={value ? undefined : placeholder ?? `Search ${entity}s…`}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          setQuery(e.target.value)
          if (!open) setOpen(true)
        }}
      />
      {clearable && value && !open ? (
        <button
          type="button"
          aria-label="Clear selection"
          onClick={() => onChange({ id: '', label: '' })}
          className="absolute right-2 top-[26px] text-[color:var(--text-3)] hover:text-[color:var(--text)]"
        >
          ×
        </button>
      ) : null}

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[color:var(--border)] bg-[var(--surface)] shadow-[0_12px_40px_rgba(15,23,42,0.12)]"
        >
          {loading ? (
            <p className="px-3 py-2 text-sm text-[color:var(--text-3)]">Searching…</p>
          ) : results.length > 0 ? (
            results.map((opt, i) => (
              <button
                key={opt.id}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={opt.id === value}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => select(opt)}
                className={`block w-full px-3 py-2 text-left text-sm ${i === highlight ? 'bg-[var(--surface-2)]' : ''} ${opt.id === value ? 'text-[color:var(--accent-strong)]' : 'text-[color:var(--text)]'}`}
              >
                <span className="block truncate">{opt.label}</span>
                {opt.meta ? <span className="block truncate text-xs text-[color:var(--text-3)]">{opt.meta}</span> : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-[color:var(--text-3)]">{term ? `No matching ${entity}s.` : `Type to search ${entity}s.`}</p>
          )}

          {normalisedDupe ? (
            <button
              type="button"
              onClick={() => select(normalisedDupe)}
              className="block w-full border-t border-[color:var(--border)] bg-[var(--amber-dim)] px-3 py-2 text-left text-xs font-medium text-[color:var(--amber-strong)]"
            >
              “{normalisedDupe.label}” already exists — link instead?
            </button>
          ) : null}

          {showCreate ? (
            <button
              id={`${listId}-create`}
              role="option"
              aria-selected={highlight === results.length}
              type="button"
              onMouseEnter={() => setHighlight(results.length)}
              onClick={createRecord}
              disabled={creating}
              className={`block w-full border-t border-[color:var(--border)] px-3 py-2 text-left text-sm font-medium text-[color:var(--accent-strong)] disabled:opacity-50 ${highlight === results.length ? 'bg-[var(--surface-2)]' : ''}`}
            >
              {creating ? 'Creating…' : `Create “${term}” as new ${entity}`}
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-1 text-xs text-[color:var(--red-strong)]">{error}</p> : null}
    </div>
  )
}
