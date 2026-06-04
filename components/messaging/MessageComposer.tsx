'use client'

import { useState } from 'react'

/** Textarea + Send. Enter sends, Shift+Enter inserts a newline. */
export default function MessageComposer({ onSend, disabled }: { onSend: (body: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState('')

  function submit() {
    const v = value.trim()
    if (!v || disabled) return
    onSend(v)
    setValue('')
  }

  return (
    <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)', alignItems: 'flex-end' }}>
      <textarea
        className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] resize-none"
        value={value}
        rows={1}
        placeholder="Write a message…"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
        style={{ maxHeight: 140 }}
      />
      <button className="btn btn-primary btn-sm" onClick={submit} disabled={disabled || !value.trim()}>
        Send
      </button>
    </div>
  )
}
