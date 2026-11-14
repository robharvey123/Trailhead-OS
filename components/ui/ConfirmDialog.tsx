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

  // Solid red is allowed here and only here: the confirming action in a dialog.
  // White on amber fails contrast, so the warning variant sets navy type.
  const btnClass = variant === 'danger'
    ? 'btn-danger-solid'
    : variant === 'warning'
      ? 'bg-[var(--amber)] text-[var(--navy)]'
      : 'btn-primary'

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="thmock fixed inset-0 z-50 m-auto w-full max-w-sm rounded-card border border-[var(--border)] p-0 shadow-[var(--shadow-lg)] backdrop:bg-[var(--navy)]/45"
    >
      <div className="p-6">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-[var(--text-2)]">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={`btn btn-sm ${btnClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
