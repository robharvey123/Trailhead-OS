'use client'

import { useEffect, useId, useState } from 'react'
import Modal from '@/components/ui/Modal'

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
  const errorId = useId()

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
        className={buttonClassName ?? `btn btn-ghost${fullWidth ? ' w-full' : ''}`}
      >
        {buttonLabel}
      </button>

      <Modal
        open={open}
        onClose={() => {
          if (!sending) {
            setOpen(false)
          }
        }}
        title={dialogTitle}
        closeLabel="Close email dialog"
        overlayClassName="z-[70] px-4 py-8"
        panelClassName="w-full max-w-2xl rounded-card border border-[color:var(--border)] bg-[var(--bg)] p-6 shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="os-eyebrow">Email</p>
            <h2 className="mt-2 os-section-title">{dialogTitle}</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={sending}
            className="btn btn-ghost btn-sm shrink-0"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="os-label mb-2 block">Recipients</span>
            <textarea
              rows={3}
              value={recipientsText}
              onChange={(event) => setRecipientsText(event.target.value)}
              placeholder="name@example.com"
              className="os-textarea w-full px-4 py-3 text-sm"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            <p className="mt-2 text-xs text-[color:var(--text-3)]">Use commas or one email per line.</p>
          </label>

          <label className="block">
            <span className="os-label mb-2 block">Subject</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="os-input w-full px-4 py-3 text-sm"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
          </label>

          <label className="block">
            <span className="os-label mb-2 block">Message</span>
            <textarea
              rows={6}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="os-textarea w-full px-4 py-3 text-sm"
            />
          </label>

          {error ? (
            <p id={errorId} role="alert" className="text-sm text-[color:var(--red-strong)]">
              {error}
            </p>
          ) : null}
          {success ? (
            <p role="status" className="text-sm text-[color:var(--emerald-strong)]">
              {success}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={sending}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending}
              className="btn btn-primary"
            >
              {sending ? 'Sending...' : 'Send email'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
