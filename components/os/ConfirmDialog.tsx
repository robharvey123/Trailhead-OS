'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
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
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  loading = false,
  variant = 'destructive',
  items,
  itemsLabel,
  secondaryAction,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)

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
            disabled={loading}
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
