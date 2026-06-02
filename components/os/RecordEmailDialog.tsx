'use client'

import { useEffect, useState } from 'react'

type RecordEmailDialogProps = {
  kind: 'enquiry' | 'quote' | 'invoice'
  recordId: string
  buttonLabel: string
  dialogTitle: string
  defaultRecipient?: string | null
  defaultSubject: string
  defaultMessage: string
  buttonClassName?: string
  fullWidth?: boolean
  onSent?: () => void | Promise<void>
}

function parseRecipients(value: string) {
  return value
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export default function RecordEmailDialog({
  kind,
  recordId,
  buttonLabel,
  dialogTitle,
  defaultRecipient,
  defaultSubject,
  defaultMessage,
  buttonClassName,
  fullWidth = false,
  onSent,
}: RecordEmailDialogProps) {
  const [open, setOpen] = useState(false)
  const [recipientsText, setRecipientsText] = useState(defaultRecipient ?? '')
  const [subject, setSubject] = useState(defaultSubject)
  const [message, setMessage] = useState(defaultMessage)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setRecipientsText(defaultRecipient ?? '')
      setSubject(defaultSubject)
      setMessage(defaultMessage)
      setError(null)
      setSuccess(null)
    }
  }, [defaultMessage, defaultRecipient, defaultSubject, open])

  async function handleSend() {
    const recipients = parseRecipients(recipientsText)

    if (!recipients.length) {
      setError('Add at least one recipient email.')
      return
    }

    if (!subject.trim()) {
      setError('Subject is required.')
      return
    }

    setSending(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/email/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          id: recordId,
          recipients,
          subject: subject.trim(),
          message: message.trim(),
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to send email.')
      }

      await onSent?.()

      setSuccess('Email sent.')
      window.setTimeout(() => {
        setOpen(false)
      }, 600)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to send email.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName ?? `${fullWidth ? 'w-full ' : ''}rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent-strong)]`}
      >
        {buttonLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-8">
          <button
            type="button"
            aria-label="Close email dialog"
            className="absolute inset-0"
            onClick={() => {
              if (!sending) {
                setOpen(false)
              }
            }}
          />

          <div className="relative w-full max-w-2xl rounded-[2rem] border border-[color:var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="os-eyebrow">Email</p>
                <h2 className="mt-2 os-section-title">{dialogTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={sending}
                className="rounded-full border border-[color:var(--border)] px-3 py-2 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--accent-strong)] disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">Recipients</span>
                <textarea
                  rows={3}
                  value={recipientsText}
                  onChange={(event) => setRecipientsText(event.target.value)}
                  placeholder="name@example.com"
                  className="os-textarea w-full"
                />
                <p className="mt-2 text-xs text-[color:var(--text-3)]">Use commas or one email per line.</p>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">Subject</span>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="os-input w-full"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[color:var(--text-2)]">Message</span>
                <textarea
                  rows={6}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="os-textarea w-full"
                />
              </label>

              {error ? <p className="text-sm text-[color:var(--red-strong)]">{error}</p> : null}
              {success ? <p className="text-sm text-[color:var(--emerald-strong)]">{success}</p> : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={sending}
                  className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent-strong)] disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={sending}
                  className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
                >
                  {sending ? 'Sending...' : 'Send email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
