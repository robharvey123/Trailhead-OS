'use client'

import { useEffect, useRef } from 'react'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (open) dialogRef.current?.showModal()
    else dialogRef.current?.close()
  }, [open])

  if (!open) return null

  const btnClass = variant === 'danger'
    ? 'bg-[var(--red)] hover:bg-[var(--red)] text-white'
    : variant === 'warning'
      ? 'bg-[var(--amber)] hover:bg-[var(--amber)] text-white'
      : 'bg-white/90 hover:bg-white text-[var(--text)]'

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="fixed inset-0 z-50 m-auto w-full max-w-sm rounded-card border border-[var(--border)] bg-[var(--bg)] p-0 text-[var(--text)] backdrop:bg-black/60"
    >
      <div className="p-6">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-[var(--text-3)]">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-control border border-[var(--border)] px-4 py-2 text-xs uppercase text-[var(--text-2)] hover:text-white">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={`rounded-control px-4 py-2 text-xs font-semibold uppercase ${btnClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
