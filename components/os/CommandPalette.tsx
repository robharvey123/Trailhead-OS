'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { apiFetch } from '@/lib/api-fetch'
import type { SearchHit } from '@/app/api/search/route'

/**
 * ⌘K command palette — the OS's only recall surface.
 *
 * Rob is a single operator holding ~21 nav destinations and thousands of records
 * in his head. Everything here is built for the keyboard: open with ⌘K, type,
 * arrow to a result, Enter to go. The mouse is the fallback, not the path.
 */

const QUICK_ACTIONS: Array<{ label: string; sub: string; href: string }> = [
  { label: 'Dashboard', sub: 'Daily brief', href: '/dashboard' },
  { label: 'Tasks', sub: 'My work', href: '/tasks' },
  { label: 'Inbox', sub: 'Email', href: '/inbox' },
  { label: 'Deals', sub: 'Pipeline', href: '/deals' },
  { label: 'Engagements', sub: 'Delivery', href: '/engagements' },
  { label: 'Timesheet', sub: 'Time tracking', href: '/timesheet' },
  { label: 'Invoicing', sub: 'Money', href: '/invoicing' },
  { label: 'Calendar', sub: 'Schedule', href: '/calendar' },
]

export default function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const trimmed = query.trim()
  const showingActions = trimmed.length < 2
  const rows: Array<{ label: string; sub: string | null; module: string; href: string }> =
    showingActions
      ? QUICK_ACTIONS.filter((a) =>
          trimmed ? a.label.toLowerCase().includes(trimmed.toLowerCase()) : true
        ).map((a) => ({ ...a, module: 'Go to' }))
      : hits

  // Reset on every open/close transition (render-time reset, not setState-in-effect).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    setQuery('')
    setHits([])
    setCursor(0)
  }

  const runSearch = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const data = await apiFetch<{ results: SearchHit[] }>(`/api/search?q=${encodeURIComponent(q)}`)
      setHits(data.results ?? [])
    } catch {
      setHits([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search.
  useEffect(() => {
    if (!open || trimmed.length < 2) return
    const timer = setTimeout(() => void runSearch(trimmed), 200)
    return () => clearTimeout(timer)
  }, [open, trimmed, runSearch])

  // Focus the input on open; restore focus to the trigger on close.
  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = overflow
      previouslyFocused.current?.focus?.()
    }
  }, [open])

  function go(href: string) {
    onOpenChange(false)
    router.push(href)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onOpenChange(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((c) => (rows.length ? (c + 1) % rows.length : 0))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((c) => (rows.length ? (c - 1 + rows.length) % rows.length : 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const target = rows[cursor]
      if (target) go(target.href)
    }
  }

  if (!mounted || !open) return null

  return createPortal(
    <div className="thmock fixed inset-0 z-[120] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close search"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 h-full w-full cursor-default bg-[#0F172A]/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search Trailhead OS"
        onKeyDown={onKeyDown}
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[color:var(--border)] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]"
      >
        <div className="flex items-center gap-3 border-b border-[color:var(--border)] px-4">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[color:var(--text-3)]">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setCursor(0)
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label="Search tasks, deals, accounts, contacts, invoices and quotes"
            placeholder="Search tasks, deals, accounts, invoices…"
            className="w-full bg-transparent py-4 text-sm text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-3)]"
          />
          <kbd className="os-mono shrink-0 rounded border border-[color:var(--border)] px-1.5 py-0.5 text-[10px] text-[color:var(--text-3)]">
            esc
          </kbd>
        </div>

        <ul id={listId} role="listbox" aria-label="Search results" className="max-h-[52vh] overflow-y-auto py-2">
          {rows.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-[color:var(--text-3)]">
              {loading ? 'Searching…' : `Nothing matches “${trimmed}”.`}
            </li>
          ) : (
            rows.map((row, index) => (
              <li key={`${row.module}-${row.href}-${index}`} role="option" aria-selected={index === cursor}>
                <button
                  type="button"
                  onClick={() => go(row.href)}
                  onMouseEnter={() => setCursor(index)}
                  className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left text-sm transition ${
                    index === cursor ? 'bg-[var(--accent-dim)]' : 'hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[color:var(--text)]">{row.label}</span>
                    {row.sub ? (
                      <span className="block truncate text-xs text-[color:var(--text-3)]">{row.sub}</span>
                    ) : null}
                  </span>
                  <span className="os-eyebrow shrink-0">{row.module}</span>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center gap-4 border-t border-[color:var(--border)] px-4 py-2 text-[11px] text-[color:var(--text-3)]">
          <span><kbd className="os-mono">↑↓</kbd> navigate</span>
          <span><kbd className="os-mono">↵</kbd> open</span>
          <span><kbd className="os-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
