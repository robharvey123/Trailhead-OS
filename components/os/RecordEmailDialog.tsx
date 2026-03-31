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
        className={buttonClassName ?? `${fullWidth ? 'w-full ' : ''}rounded-2xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500`}
      >
        {buttonLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 px-4 py-8">
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

          <div className="relative w-full max-w-2xl rounded-[2rem] border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Email</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-50">{dialogTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={sending}
                className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Recipients</span>
                <textarea
                  rows={3}
                  value={recipientsText}
                  onChange={(event) => setRecipientsText(event.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                />
                <p className="mt-2 text-xs text-slate-500">Use commas or one email per line.</p>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Subject</span>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Message</span>
                <textarea
                  rows={6}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                />
              </label>

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={sending}
                  className="rounded-2xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={sending}
                  className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
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
