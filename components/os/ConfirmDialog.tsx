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
  /** Hide the confirm button entirely (e.g. a blocked/informational dialog with only Close). */
  hideConfirm?: boolean
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
  hideConfirm = false,
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

  // The solid red button is the confirm dialog's own. The warning variant keeps
  // its amber fill with navy type: white on amber fails contrast.
  const confirmVariant =
    variant === 'destructive'
      ? 'btn-danger-solid'
      : 'bg-[var(--amber)] text-[var(--navy)] hover:bg-[var(--amber)]/85'

  return createPortal(
    // `thmock` is required: this portals to document.body, OUTSIDE the app's
    // .thmock wrapper where the design tokens (--red, --border, --text, …) are
    // defined. Without it, the destructive button's bg-[var(--red)] resolves to
    // nothing and the white-text button is invisible (looked like "Cancel only").
    <div
      className="thmock fixed inset-0 z-50 flex items-center justify-center bg-[var(--navy)]/45"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
    >
      <div
        ref={panelRef}
        className="mx-4 w-full max-w-md rounded-card border border-[color:var(--border)] bg-[var(--bg)] p-6 shadow-[var(--shadow-lg)]"
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
          <div className="mb-4 rounded-control border border-[color:var(--border)] bg-[var(--surface-2)] p-3">
            {itemsLabel ? (
              <p className="os-label mb-2">
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
            <label className="field-label block">
              {confirmPhraseLabel ?? `Type “${confirmPhrase}” to confirm`}
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={loading}
              autoFocus
              className="os-input w-full px-3 py-2 text-sm"
              placeholder={confirmPhrase}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            // Default focus on Cancel (not the destructive action) so Enter can't
            // accidentally confirm — unless there's a type-to-confirm input to focus.
            autoFocus={confirmPhrase == null}
            className="btn btn-ghost"
          >
            {cancelLabel}
          </button>
          {secondaryAction ? (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={loading}
              className="btn btn-ghost"
            >
              {secondaryAction.label}
            </button>
          ) : null}
          {hideConfirm ? null : (
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || phraseUnmet}
            className={`btn ${confirmVariant}`}
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
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
