'use client'

import { useId, useState } from 'react'

const REASONS = [
  { value: 'price', label: 'Price' },
  { value: 'timing', label: 'Timing' },
  { value: 'scope', label: 'Not the right scope' },
  { value: 'other', label: 'Something else' },
] as const

type Reason = (typeof REASONS)[number]['value']

/** A quiet text link under the question form, never a button competing with Accept. */
export default function DeclineLink({ token, onDeclined }: { token: string; onDeclined: () => void }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<Reason | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <p className="mt-4 text-sm text-[color:var(--text-3)]">
        Not going ahead?{' '}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded underline underline-offset-2 hover:text-[color:var(--text-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
        >
          Let Rob know
        </button>
      </p>
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!reason) return
    setSending(true)
    setError(null)
    try {
      const response = await fetch(`/api/proposal/${token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, message: message || null }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? 'Something went wrong. Please try again.')
        setSending(false)
        return
      }
      onDeclined()
    } catch {
      setError('Could not reach the server. Please try again.')
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-white p-4 text-sm">
      <fieldset>
        <legend className="mb-2 font-medium text-[color:var(--text)]">What&apos;s the main reason?</legend>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((option) => (
            <label key={option.value} className="cursor-pointer">
              <input type="radio" name={`${id}-reason`} value={option.value} checked={reason === option.value} onChange={() => setReason(option.value)} className="peer sr-only" />
              <span className="inline-block rounded-[var(--radius-pill)] border border-[color:var(--border-light)] px-3 py-1.5 text-[color:var(--text-2)] peer-checked:border-[color:var(--navy)] peer-checked:bg-[color:var(--navy)] peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--focus)]">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={`${id}-msg`} className="mb-1 block text-[color:var(--text-2)]">
          Anything else? <span className="text-[color:var(--text-3)]">(optional)</span>
        </label>
        <textarea id={`${id}-msg`} rows={2} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full rounded-[var(--radius-control)] border border-[color:var(--border-light)] px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--focus)]" />
      </div>
      {error ? (
        <p role="alert" className="text-[color:var(--red-strong)]">
          {error}
        </p>
      ) : null}
      <div className="flex gap-4">
        <button type="submit" disabled={!reason || sending} className="rounded font-semibold text-[color:var(--text)] underline underline-offset-2 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]">
          {sending ? 'Sending…' : 'Decline proposal'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded text-[color:var(--text-3)] hover:text-[color:var(--text-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]">
          Cancel
        </button>
      </div>
    </form>
  )
}
