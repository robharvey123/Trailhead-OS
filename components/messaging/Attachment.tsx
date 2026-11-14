'use client'

import { useCallback, useEffect, useState } from 'react'
import { getAttachmentUrl, type ChatAttachment } from '@/app/(os)/messages/actions'

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function iconFor(mime: string): string {
  if (mime === 'application/pdf') return '📄'
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv') return '📊'
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📈'
  if (mime.includes('word') || mime.startsWith('text/')) return '📝'
  if (mime === 'application/zip') return '🗜️'
  return '📎'
}

export default function Attachment({ attachment }: { attachment: ChatAttachment }) {
  const isImage = attachment.mime_type.startsWith('image/')
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState(false)
  const [busy, setBusy] = useState(false)

  // Image thumbnails: mint a signed URL once on mount (in-memory only, never cached to storage).
  useEffect(() => {
    if (!isImage) return
    let active = true
    void getAttachmentUrl(attachment.id).then((res) => {
      if (active && res.url) setImgUrl(res.url)
    })
    return () => { active = false }
  }, [attachment.id, isImage])

  const openFile = useCallback(async () => {
    setBusy(true)
    const res = await getAttachmentUrl(attachment.id)
    setBusy(false)
    if (res.url) window.open(res.url, '_blank', 'noopener,noreferrer')
  }, [attachment.id])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  if (isImage) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="block cursor-pointer border-none bg-transparent p-0"
          aria-label={`Open image ${attachment.file_name}`}
        >
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgUrl} alt={attachment.file_name} loading="lazy" className="max-h-80 max-w-80 rounded-control border border-[var(--border)] object-cover" />
          ) : (
            <div className="h-[140px] w-[200px] rounded-control border border-[var(--border)] bg-[var(--surface-2)]" />
          )}
        </button>
        {lightbox && imgUrl ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={attachment.file_name}
            onClick={() => setLightbox(false)}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--navy)]/80 p-6"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt={attachment.file_name} className="max-h-[90vh] max-w-[95vw] rounded-control" />
          </div>
        ) : null}
      </>
    )
  }

  return (
    <div className="flex max-w-80 items-center gap-2.5 rounded-control border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
      <span className="flex-none text-xl">{iconFor(attachment.mime_type)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-[var(--text)]">{attachment.file_name}</span>
        <span className="text-[11px] text-[var(--text-3)]">{fmtBytes(attachment.byte_size)}</span>
      </span>
      <button className="btn btn-ghost btn-sm flex-none" onClick={openFile} disabled={busy}>
        {busy ? '…' : attachment.mime_type === 'application/pdf' ? 'Open' : 'Download'}
      </button>
    </div>
  )
}
