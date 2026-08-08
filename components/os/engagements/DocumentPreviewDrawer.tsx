'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { formatBytes, formatDate, mimeKind, mimeLabel } from '@/lib/documents/format'

export type PreviewDoc = {
  id: string
  title: string | null
  file_name: string | null
  file_path: string | null
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

/**
 * Right-hand preview drawer for an engagement document. Renders images and PDFs
 * inline from a short-lived signed URL and falls back to a download card for
 * everything else.
 *
 * The preview and download sources are the same `[docId]` API route (RLS-scoped,
 * signed under the user's session): `?preview=1` serves inline, the bare route
 * forces the download. We never hold the signed URL in client state — the browser
 * follows the redirect each time the drawer opens, so it is always fresh and never
 * lands in the URL bar or localStorage.
 */
export default function DocumentPreviewDrawer({
  engagementId,
  doc,
  onClose,
}: {
  engagementId: string
  doc: PreviewDoc | null
  onClose: () => void
}) {
  const open = !!doc
  // Keep the last document mounted through the slide-out so the panel doesn't flash
  // empty. Adjusted during render (not an effect) per React guidance: when a new doc
  // arrives we retain it; when doc goes null on close we keep the previous one.
  const [shown, setShown] = useState<PreviewDoc | null>(doc)
  if (doc && doc !== shown) setShown(doc)

  // `loaded` is derived: the media is loaded once onLoad has fired for THIS doc id, so
  // switching documents shows the skeleton again with no effect-driven reset.
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const loaded = !!shown && loadedId === shown.id

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const previewUrl = shown ? `/api/engagements/${engagementId}/documents/${shown.id}?preview=1` : ''
  const downloadUrl = shown ? `/api/engagements/${engagementId}/documents/${shown.id}` : ''
  const kind = shown ? mimeKind(shown.mime_type) : 'other'
  const name = shown?.title || shown?.file_name || 'Document'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview: ${name}`}
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-[var(--surface)] shadow-2xl transition-transform duration-200 ease-out sm:w-[560px] lg:w-[720px] ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {shown ? (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[color:var(--border)] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--text)]" title={name}>{name}</p>
                <p className="mt-0.5 text-xs text-[color:var(--text-3)]">
                  {mimeLabel(shown.mime_type, shown.file_name)} · {formatBytes(shown.size_bytes)} · {formatDate(shown.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {shown.file_path ? (
                  <a
                    href={downloadUrl}
                    className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--text-2)] hover:text-[color:var(--text)]"
                  >
                    Download
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close preview"
                  className="rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-xs text-[color:var(--text-2)] hover:text-[color:var(--text)]"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="relative flex-1 overflow-auto bg-[var(--surface-2)]">
              {!shown.file_path ? (
                <FallbackCard name={name} sub="This document has no attached file." />
              ) : kind === 'image' ? (
                <div className="flex h-full items-center justify-center p-4">
                  {!loaded ? <Skeleton /> : null}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={name}
                    onLoad={() => setLoadedId(shown.id)}
                    className={`max-h-full max-w-full object-contain ${loaded ? '' : 'hidden'}`}
                  />
                </div>
              ) : kind === 'pdf' ? (
                <>
                  {/* Desktop: inline iframe. iOS/small screens render PDF iframes badly, so below md we offer a new-tab link instead. */}
                  <div className="hidden h-full w-full md:block">
                    {!loaded ? <div className="absolute inset-0 flex items-center justify-center"><Skeleton /></div> : null}
                    <iframe
                      src={`${previewUrl}#toolbar=1&view=FitH`}
                      title={name}
                      onLoad={() => setLoadedId(shown.id)}
                      className="h-full w-full border-0"
                    />
                  </div>
                  <div className="flex h-full items-center justify-center p-6 md:hidden">
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Open PDF
                    </a>
                  </div>
                </>
              ) : (
                <FallbackCard
                  name={name}
                  sub={`${mimeLabel(shown.mime_type, shown.file_name)} · ${formatBytes(shown.size_bytes)}`}
                  action={
                    <a
                      href={downloadUrl}
                      className="mt-4 inline-block rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      Download file
                    </a>
                  }
                />
              )}
            </div>
          </>
        ) : null}
      </div>
    </>
  )
}

function Skeleton() {
  return <div className="h-40 w-40 animate-pulse rounded-xl bg-[var(--surface-3)]" />
}

function FallbackCard({ name, sub, action }: { name: string; sub: string; action?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 text-4xl">📄</div>
      <p className="max-w-full truncate text-sm font-semibold text-[color:var(--text)]" title={name}>{name}</p>
      <p className="mt-1 text-xs text-[color:var(--text-3)]">{sub}</p>
      {action}
    </div>
  )
}
