'use client'

import { useId, useState } from 'react'

interface QuestionFormProps {
  token: string | null
  disabled: boolean
  /** Set by "Ask for an updated quote" to fill the message. The parent keys the form on it. */
  prefill: string | null
}

const field =
  'w-full rounded-[var(--radius-control)] border border-[color:var(--border-light)] bg-white px-3 py-2.5 text-base text-[color:var(--text)] placeholder:text-[color:var(--text-3)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--focus)] disabled:bg-[color:var(--surface-2)]'
const label = 'mb-1 block text-sm font-medium text-[color:var(--text)]'

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'error'; message: string }

export default function QuestionForm({ token, disabled, prefill }: QuestionFormProps) {
  const id = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(prefill ?? '')
  const [website, setWebsite] = useState('') // honeypot
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!token || disabled) return
    setStatus({ kind: 'sending' })
    try {
      const response = await fetch(`/api/proposal/${token}/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, website }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setStatus({ kind: 'error', message: body?.error ?? 'Something went wrong. Please email instead.' })
        return
      }
      setStatus({ kind: 'sent' })
    } catch {
      setStatus({ kind: 'error', message: 'Could not send. Check your connection, or email instead.' })
    }
  }

  if (status.kind === 'sent') {
    return (
      <div role="status" className="os-card p-5 text-sm text-[color:var(--text-2)]">
        <p className="font-semibold text-[color:var(--text)]">Thanks, your message is on its way.</p>
        <p>Rob will reply to {email} soon.</p>
      </div>
    )
  }

  return (
    <div>
      <form onSubmit={submit} className="os-card space-y-4 p-5" noValidate={false}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-name`} className={label}>
              Your name
            </label>
            <input id={`${id}-name`} required maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} className={field} />
          </div>
          <div>
            <label htmlFor={`${id}-email`} className={label}>
              Email
            </label>
            <input id={`${id}-email`} type="email" required maxLength={200} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={disabled} className={field} />
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-message`} className={label}>
            Message
          </label>
          <textarea id={`${id}-message`} required maxLength={2000} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} disabled={disabled} className={field} />
        </div>
        {/* Honeypot: hidden from people and assistive tech, filled only by bots. */}
        <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
          <label htmlFor={`${id}-website`}>Website</label>
          <input id={`${id}-website`} tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        {status.kind === 'error' ? (
          <p role="alert" className="text-sm font-medium text-[color:var(--red-strong)]">
            {status.message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={disabled || status.kind === 'sending'}
          className="inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[color:var(--navy)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--navy-deep)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status.kind === 'sending' ? 'Sending…' : 'Send question'}
        </button>
      </form>
    </div>
  )
}
