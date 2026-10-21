'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendFollowUpEmail } from './actions'

export default function FollowUpEmail({ contactId, contactEmail, blocked }: { contactId: string; contactEmail: string | null; blocked: boolean }) {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const input = 'w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'

  if (!contactEmail) return <p className="text-sm text-[color:var(--text-3)]">No email address on file, so no follow-up email.</p>
  if (blocked) return <p className="text-sm text-[color:var(--text-3)]">Unsubscribed or bounced, so no follow-up email.</p>

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        setMsg(null)
        start(async () => {
          const res = await sendFollowUpEmail(contactId, { subject, body })
          if (!res.ok) {
            setMsg({ ok: false, text: res.error })
            return
          }
          setMsg({ ok: true, text: 'Sent. Opens will show on the timeline.' })
          setSubject('')
          setBody('')
          router.refresh()
        })
      }}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-3)]">Follow-up email to {contactEmail}</p>
      <input aria-label="Subject" className={input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
      <textarea aria-label="Message" rows={5} className={input} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi Alice, good to speak earlier…" />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending || !subject.trim() || !body.trim()}>{pending ? 'Sending…' : 'Send from my address'}</button>
        <span role="status" className="text-xs">{msg ? <span className={msg.ok ? 'text-[color:var(--text-2)]' : 'text-[color:var(--red)]'}>{msg.text}</span> : null}</span>
      </div>
    </form>
  )
}
