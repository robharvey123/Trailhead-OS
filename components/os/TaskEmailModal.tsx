'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiFetch } from '@/lib/api-fetch'
import type { TaskWithWorkstream } from '@/lib/types'

interface TaskEmailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tasks: TaskWithWorkstream[]
}

type SendState = 'idle' | 'sending' | 'sent' | 'error'

export default function TaskEmailModal({ open, onOpenChange, tasks }: TaskEmailModalProps) {
  const [recipients, setRecipients] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [message, setMessage] = useState('')
  const [sendState, setSendState] = useState<SendState>('idle')
  const [sentCount, setSentCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  useEffect(() => {
    if (open) {
      setRecipients([])
      setInputValue('')
      setMessage('')
      setSendState('idle')
      setErrorMessage('')
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  function addRecipient(email: string) {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return
    if (recipients.includes(trimmed)) return
    setRecipients((prev) => [...prev, trimmed])
    setInputValue('')
  }

  function removeRecipient(email: string) {
    setRecipients((prev) => prev.filter((r) => r !== email))
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addRecipient(inputValue)
    }
    if (e.key === 'Backspace' && !inputValue && recipients.length > 0) {
      setRecipients((prev) => prev.slice(0, -1))
    }
  }

  async function handleSend() {
    if (recipients.length === 0) return
    setSendState('sending')
    setErrorMessage('')

    try {
      const response = await apiFetch<{ success: boolean; sent: number }>('/api/tasks/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskIds: tasks.map((t) => t.id),
          recipients,
          message: message.trim() || undefined,
        }),
      })
      setSentCount(response.sent)
      setSendState('sent')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send')
      setSendState('error')
    }
  }

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)]"
      onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false) }}
    >
      <div className="mx-4 w-full max-w-lg rounded-lg border border-[color:var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
        <p className="os-eyebrow mb-4 text-[color:var(--accent-strong)]">
          EMAIL TASKS
        </p>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {tasks.map((task) => (
            <span
              key={task.id}
              className="rounded border border-[color:var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px] text-[color:var(--text)]"
            >
              {task.title}
            </span>
          ))}
        </div>

        {sendState === 'sent' ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <svg className="h-8 w-8 text-[color:var(--green-strong)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-[color:var(--green-strong)]">Sent to {sentCount} recipient{sentCount > 1 ? 's' : ''}</p>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-2 rounded border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm text-[color:var(--text)] hover:bg-[var(--surface-3)]"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <p className="os-eyebrow mb-1.5 text-[color:var(--text-2)]">TO</p>
              <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded border border-[color:var(--border)] bg-[var(--surface-2)] px-2 py-1.5">
                {recipients.map((r) => (
                  <span key={r} className="flex items-center gap-1 rounded border border-[color:var(--border)] bg-white px-2 py-1 text-xs text-[color:var(--text)]">
                    {r}
                    <button
                      type="button"
                      onClick={() => removeRecipient(r)}
                      className="ml-0.5 text-[color:var(--text-2)] hover:text-[color:var(--text)]"
                    >
                      &times;
                    </button>
                  </span>
                ))}
                <input
                  ref={inputRef}
                  type="email"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  onBlur={() => { if (inputValue.trim()) addRecipient(inputValue) }}
                  placeholder={recipients.length === 0 ? 'Type email and press Enter' : ''}
                  className="min-w-[120px] flex-1 border-none bg-transparent text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-3)] outline-none"
                />
              </div>
            </div>

            <div className="mb-4">
              <p className="os-eyebrow mb-1.5 text-[color:var(--text-2)]">
                COVERING NOTE (OPTIONAL)
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Add a message..."
                className="os-textarea w-full"
              />
            </div>

            {errorMessage ? (
              <p className="mb-3 text-sm text-[color:var(--red-strong)]">{errorMessage}</p>
            ) : null}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-2 text-[color:var(--text)] hover:bg-[var(--surface-3)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={recipients.length === 0 || sendState === 'sending'}
                className="rounded bg-[var(--accent)] px-4 py-2 font-bold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {sendState === 'sending' ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  `Send to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
