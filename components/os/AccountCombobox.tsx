'use client'

import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'

interface AccountOption {
  id: string
  name: string
}

interface AccountComboboxProps {
  label: string
  /** Currently selected account id (empty string when none). */
  value: string
  /** Display name for the current selection, so it shows without a search round-trip. */
  selectedName?: string
  onChange: (account: AccountOption) => void
}

const inputClass =
  'w-full rounded-xl border border-[color:var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[color:var(--text)] placeholder-[color:var(--text-3)] focus:border-[color:var(--accent)] focus:outline-none'
const labelClass =
  'mb-1 block text-xs font-medium uppercase tracking-wide text-[color:var(--text-2)]'

export default function AccountCombobox({ label, value, selectedName, onChange }: AccountComboboxProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AccountOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced server-side search.
  useEffect(() => {
    if (!open) return
    const term = query.trim()
    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        const params = term ? `?search=${encodeURIComponent(term)}` : ''
        const { accounts } = await apiFetch<{ accounts: AccountOption[] }>(`/api/accounts${params}`)
        setResults(accounts.slice(0, 20).map((a) => ({ id: a.id, name: a.name })))
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(handle)
  }, [query, open])

  // Close the dropdown on outside click.
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(account: AccountOption) {
    onChange(account)
    setOpen(false)
    setQuery('')
    setError('')
  }

  async function createAccount() {
    const name = query.trim()
    if (!name || creating) return
    setCreating(true)
    setError('')
    try {
      const { account } = await apiFetch<{ account: AccountOption }>('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      select({ id: account.id, name: account.name })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setCreating(false)
    }
  }

  const term = query.trim()
  const exactMatch = results.some((r) => r.name.toLowerCase() === term.toLowerCase())

  return (
    <div ref={containerRef} className="relative">
      <label className={labelClass}>{label}</label>
      <input
        className={inputClass}
        value={open ? query : selectedName ?? ''}
        placeholder={value ? undefined : 'Search accounts…'}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          if (!open) setOpen(true)
        }}
      />

      {open ? (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[color:var(--border)] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.12)]">
          {loading ? (
            <p className="px-3 py-2 text-sm text-[color:var(--text-3)]">Searching…</p>
          ) : results.length > 0 ? (
            results.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => select(account)}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)] ${
                  account.id === value ? 'text-[color:var(--accent-strong)]' : 'text-[color:var(--text)]'
                }`}
              >
                {account.name}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-[color:var(--text-3)]">
              {term ? 'No matching accounts.' : 'Type to search accounts.'}
            </p>
          )}

          {term && !exactMatch ? (
            <button
              type="button"
              onClick={createAccount}
              disabled={creating}
              className="block w-full border-t border-[color:var(--border)] px-3 py-2 text-left text-sm font-medium text-[color:var(--accent-strong)] hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              {creating ? 'Creating…' : `Create “${term}” as new account`}
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-1 text-xs text-[color:var(--red-strong)]">{error}</p> : null}
    </div>
  )
}
