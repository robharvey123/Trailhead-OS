'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { rematchMeetingNote } from '@/app/(os)/crm/actions'

/** Small inline control to re-run matching for a low-confidence meeting note. */
export default function MeetingNoteRematch({ noteId }: { noteId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    setBusy(true)
    setError(null)
    const res = await rematchMeetingNote(noteId)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] transition hover:border-[var(--lime)]/40 disabled:opacity-60"
      >
        {busy ? 'Re-matching…' : 'Re-match'}
      </button>
      {error ? <span className="text-xs text-rose-300">{error}</span> : null}
    </span>
  )
}
