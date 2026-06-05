'use client'

import { useRef, useState } from 'react'

const MAX_FILES = 4
const MAX_BYTES = 25 * 1024 * 1024
const ALLOWED = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'text/csv', 'text/markdown',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
])

function fmtBytes(n: number): string {
  return n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function MessageComposer({
  onSend,
  onTyping,
  disabled,
}: {
  onSend: (body: string, files: File[]) => void
  onTyping?: () => void
  disabled?: boolean
}) {
  const [value, setValue] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list)
    setError('')
    const accepted: File[] = []
    for (const f of incoming) {
      if (!ALLOWED.has(f.type)) { setError(`“${f.name}” is not an allowed file type.`); continue }
      if (f.size > MAX_BYTES) { setError(`“${f.name}” is over 25 MB.`); continue }
      accepted.push(f)
    }
    setFiles((cur) => {
      const merged = [...cur, ...accepted]
      if (merged.length > MAX_FILES) {
        setError(`Up to ${MAX_FILES} files per message.`)
        return merged.slice(0, MAX_FILES)
      }
      return merged
    })
  }

  function submit() {
    const v = value.trim()
    if ((!v && files.length === 0) || disabled) return
    onSend(v, files)
    setValue('')
    setFiles([])
    setError('')
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      {files.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 12px 0' }}>
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', color: 'var(--text-2)' }}>
              📎 {f.name} <span style={{ color: 'var(--text-3)' }}>{fmtBytes(f.size)}</span>
              <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>✕</button>
            </span>
          ))}
        </div>
      ) : null}
      {error ? <p style={{ color: 'var(--red)', fontSize: 12, padding: '6px 12px 0', margin: 0 }}>{error}</p> : null}

      <div
        style={{ display: 'flex', gap: 8, padding: 12, alignItems: 'flex-end', outline: dragOver ? '2px dashed var(--accent)' : 'none', outlineOffset: -4 }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files) }}
      >
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()} disabled={disabled} aria-label="Attach files" style={{ flex: 'none' }}>📎</button>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
        <textarea
          className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] resize-none"
          value={value}
          rows={1}
          placeholder="Write a message…"
          onChange={(e) => { setValue(e.target.value); onTyping?.() }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          style={{ maxHeight: 140 }}
        />
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={disabled || (!value.trim() && files.length === 0)} style={{ flex: 'none' }}>Send</button>
      </div>
    </div>
  )
}
