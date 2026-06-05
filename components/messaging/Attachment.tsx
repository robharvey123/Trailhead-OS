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
          style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'block' }}
          aria-label={`Open image ${attachment.file_name}`}
        >
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imgUrl} alt={attachment.file_name} loading="lazy" style={{ maxWidth: 320, maxHeight: 320, borderRadius: 10, border: '1px solid var(--border)', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 200, height: 140, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
          )}
        </button>
        {lightbox && imgUrl ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={attachment.file_name}
            onClick={() => setLightbox(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt={attachment.file_name} style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 8 }} />
          </div>
        ) : null}
      </>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', maxWidth: 320 }}>
      <span style={{ fontSize: 20, flex: 'none' }}>{iconFor(attachment.mime_type)}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.file_name}</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtBytes(attachment.byte_size)}</span>
      </span>
      <button className="btn btn-ghost btn-sm" onClick={openFile} disabled={busy} style={{ flex: 'none' }}>
        {busy ? '…' : attachment.mime_type === 'application/pdf' ? 'Open' : 'Download'}
      </button>
    </div>
  )
}
