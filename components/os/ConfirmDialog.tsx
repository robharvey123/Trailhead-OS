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
      ? 'bg-[#FF4081] text-white hover:bg-[#FF4081]/80'
      : 'bg-[#FBBF24] text-[#0C0C14] hover:bg-[#FBBF24]/80'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0C0C14]/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
    >
      <div
        ref={panelRef}
        className="mx-4 w-full max-w-md rounded-lg border border-[#2A2A3A] bg-[#1A1A28] p-6"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <h2 id="confirm-dialog-title" className="mb-2 text-lg font-bold text-white">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="mb-4 text-sm text-[#9CA3AF]">
          {description}
        </p>

        {items && items.length > 0 ? (
          <div className="mb-4 rounded border border-[#2A2A3A] bg-[#13131E] p-3">
            {itemsLabel ? (
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[2px] text-[#9CA3AF]">
                {itemsLabel}
              </p>
            ) : null}
            {items.map((item, index) => (
              <p
                key={index}
                className="border-b border-[#2A2A3A] py-1 text-[11px] text-[#9CA3AF] last:border-0"
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
            className="rounded border border-[#2A2A3A] bg-[#13131E] px-4 py-2 text-white hover:border-[#B8FF00]/30"
          >
            {cancelLabel}
          </button>
          {secondaryAction ? (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={loading}
              className="rounded border border-[#2A2A3A] bg-[#13131E] px-4 py-2 text-white hover:border-[#B8FF00]/30 disabled:opacity-60"
            >
              {secondaryAction.label}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded px-4 py-2 font-bold disabled:opacity-60 ${confirmColour}`}
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
