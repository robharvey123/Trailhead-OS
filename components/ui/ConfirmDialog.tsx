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
    ? 'bg-rose-600 hover:bg-rose-500 text-white'
    : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-500 text-white'
      : 'bg-white/90 hover:bg-white text-slate-950'

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      className="fixed inset-0 z-50 m-auto w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 backdrop:bg-black/60"
    >
      <div className="p-6">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-slate-400">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase ${btnClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
