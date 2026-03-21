'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { apiFetch } from '@/lib/api-fetch'

type SearchResult = { id: string; label: string; sub: string | null; module: string }
type SearchResults = Record<string, SearchResult[]>

const MODULE_LABELS: Record<string, string> = {
  accounts: 'Accounts',
  contacts: 'Contacts',
  deals: 'Deals',
  invoices: 'Invoices',
  tasks: 'Tasks',
}

export default function GlobalSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Extract workspaceId from pathname
  const match = pathname.match(/\/workspace\/([^/]+)/)
  const workspaceId = match?.[1]

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = useCallback(async (q: string) => {
    if (!workspaceId || q.length < 2) { setResults(null); return }
    try {
      const data = await apiFetch<{ results: SearchResults }>(`/api/workspace/search?workspace_id=${workspaceId}&q=${encodeURIComponent(q)}`)
      setResults(data.results)
      setOpen(true)
    } catch {
      setResults(null)
    }
  }, [workspaceId])

  const handleChange = (value: string) => {
    setQuery(value)
    clearTimeout(timerRef.current)
    if (value.length >= 2) {
      timerRef.current = setTimeout(() => search(value), 300)
    } else {
      setResults(null)
      setOpen(false)
    }
  }

  const navigate = (module: string, id: string) => {
    setOpen(false)
    setQuery('')
    setResults(null)
    if (module === 'tasks') {
      router.push(`/workspace/${workspaceId}`)
    } else {
      router.push(`/workspace/${workspaceId}/${module}/${id}`)
    }
  }

  if (!workspaceId) return null

  const hasResults = results && Object.values(results).some((arr) => arr.length > 0)

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => results && setOpen(true)}
        placeholder="Search..."
        className="w-48 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none sm:w-64"
      />
      {open && results && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
          {!hasResults ? (
            <p className="px-4 py-3 text-xs text-slate-500">No results found</p>
          ) : (
            Object.entries(results).filter(([, arr]) => arr.length > 0).map(([module, items]) => (
              <div key={module}>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{MODULE_LABELS[module] || module}</p>
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.module, item.id)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-slate-800"
                  >
                    <span className="truncate font-medium">{item.label}</span>
                    {item.sub && <span className="ml-auto truncate text-xs text-slate-500">{item.sub}</span>}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
