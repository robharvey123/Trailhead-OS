'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addComment } from '@/app/(os)/my-work/actions'
import type { EngagementTaskCommentWithAuthor } from '@/lib/types'

function fmt(v: string) {
  return new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function CommentThread({
  taskId,
  comments,
  canComment,
}: {
  taskId: string
  comments: EngagementTaskCommentWithAuthor[]
  canComment: boolean
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!body.trim()) return
    setBusy(true); setError('')
    const res = await addComment(taskId, body)
    if (res.error) { setError(res.error); setBusy(false); return }
    setBody(''); setBusy(false)
    router.refresh()
  }

  return (
    <div>
      <div className="mb-3.5 grid gap-2.5">
        {comments.length === 0 ? <p className="text-[13px] text-[var(--text-3)]">No comments yet.</p> : comments.map((c) => (
          <div key={c.id} className="card">
            <div className="mb-1 flex justify-between text-xs text-[var(--text-2)]">
              <span className="td-name">{c.author?.full_name ?? 'Unknown'}</span>
              <span className="td-num">{fmt(c.created_at)}</span>
            </div>
            {/* Plain text only — never rendered as HTML. */}
            <p className="m-0 whitespace-pre-wrap text-[13px]">{c.body}</p>
          </div>
        ))}
      </div>
      {canComment ? (
        <div className="grid gap-2">
          <textarea
            className="w-full rounded-control border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] min-h-[4rem] resize-y"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
          />
          {error ? <p className="text-xs text-[var(--red)]">{error}</p> : null}
          <div className="text-right">
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy || !body.trim()}>{busy ? 'Posting…' : 'Comment'}</button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-3)]">Your login has no linked person record, so you can’t comment.</p>
      )}
    </div>
  )
}
