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
      <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
        {comments.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No comments yet.</p> : comments.map((c) => (
          <div key={c.id} className="card" style={{ padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
              <span className="td-name">{c.author?.full_name ?? 'Unknown'}</span>
              <span className="td-mono">{fmt(c.created_at)}</span>
            </div>
            {/* Plain text only — never rendered as HTML. */}
            <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', margin: 0 }}>{c.body}</p>
          </div>
        ))}
      </div>
      {canComment ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <textarea
            className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] min-h-[4rem] resize-y"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
          />
          {error ? <p style={{ color: 'var(--red)', fontSize: 12 }}>{error}</p> : null}
          <div style={{ textAlign: 'right' }}>
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy || !body.trim()}>{busy ? 'Posting…' : 'Comment'}</button>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Your login has no linked person record, so you can’t comment.</p>
      )}
    </div>
  )
}
