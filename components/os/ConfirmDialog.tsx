'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** Optional callout rendered between the description and the items list. */
  banner?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  loading?: boolean
  variant?: 'destructive' | 'warning'
  items?: string[]
  itemsLabel?: string
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  /** When set, the user must type this exact phrase before the confirm button enables. */
  confirmPhrase?: string
  /** Label shown above the type-to-confirm input. */
  confirmPhraseLabel?: string
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  banner,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  loading = false,
  variant = 'destructive',
  items,
  itemsLabel,
  secondaryAction,
  confirmPhrase,
  confirmPhraseLabel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [typed, setTyped] = useState('')

  // Reset the type-to-confirm field on every open/close transition, so a re-open starts blank.
  // (Render-time reset — the React-sanctioned alternative to a setState-in-effect.)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    setTyped('')
  }

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  const phraseUnmet = confirmPhrase != null && typed.trim() !== confirmPhrase.trim()

  const confirmColour =
    variant === 'destructive'
      ? 'bg-[var(--red)] text-white hover:bg-[var(--red-strong)]'
      : 'bg-[var(--amber)] text-white hover:bg-[var(--amber-strong)]'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
    >
      <div
        ref={panelRef}
        className="mx-4 w-full max-w-md rounded-lg border border-[color:var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)]"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <h2 id="confirm-dialog-title" className="mb-2 text-lg font-bold text-[color:var(--text)]">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="mb-4 text-sm text-[color:var(--text-2)]">
          {description}
        </p>

        {banner ? <div className="mb-4">{banner}</div> : null}

        {items && items.length > 0 ? (
          <div className="mb-4 rounded border border-[color:var(--border)] bg-[var(--surface-2)] p-3">
            {itemsLabel ? (
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[2px] text-[color:var(--text-2)]">
                {itemsLabel}
              </p>
            ) : null}
            {items.map((item, index) => (
              <p
                key={index}
                className="border-b border-[color:var(--border)] py-1 text-[11px] text-[color:var(--text-2)] last:border-0"
              >
                {item}
              </p>
            ))}
          </div>
        ) : null}

        {confirmPhrase != null ? (
          <div className="mb-4">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-3)]">
              {confirmPhraseLabel ?? `Type “${confirmPhrase}” to confirm`}
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={loading}
              autoFocus
              className="w-full rounded border border-[color:var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[color:var(--text)] outline-none focus:border-[var(--accent)]"
              placeholder={confirmPhrase}
            />
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded border border-[color:var(--border)] bg-white px-4 py-2 text-[color:var(--text)] hover:bg-[var(--surface-2)]"
          >
            {cancelLabel}
          </button>
          {secondaryAction ? (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={loading}
              className="rounded border border-[color:var(--border)] bg-white px-4 py-2 text-[color:var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              {secondaryAction.label}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || phraseUnmet}
            className={`rounded px-4 py-2 font-bold disabled:opacity-50 ${confirmColour}`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {confirmLabel}
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
