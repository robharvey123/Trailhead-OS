'use client'

import { useEffect, useMemo, useState } from 'react'
import type { EmailLog } from '@/lib/types'
import SafeEmailHtml from './SafeEmailHtml'

const EMAIL_INTEGRATION_PAUSED = true

type EmailThreadProps = {
  contact_id?: string | null
  contact_email?: string | null
  account_id?: string | null
  enquiry_id?: string | null
  quote_id?: string | null
  title?: string
  embedded?: boolean
}

type ThreadMessage = Partial<EmailLog> & {
  gmail_message_id?: string
  gmail_thread_id?: string
  from_address?: string
  to_addresses?: string[]
  subject?: string
  snippet?: string
  body_html?: string
  body_text?: string
  received_at?: string
  sent_at?: string
}

function formatDate(value?: string) {
  if (!value) {
    return 'Unknown date'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getMessageDate(message: ThreadMessage) {
  return message.received_at ?? message.sent_at ?? message.created_at ?? ''
}

export default function EmailThread({
  contact_id,
  contact_email,
  account_id,
  enquiry_id,
  quote_id,
  title = 'Email thread',
  embedded = false,
}: EmailThreadProps) {
  const emailFeaturePaused = EMAIL_INTEGRATION_PAUSED
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [loading, setLoading] = useState<boolean>(
    Boolean(contact_email) && !emailFeaturePaused
  )
  const [error, setError] = useState<string | null>(null)
  const [googleDisconnected, setGoogleDisconnected] = useState<boolean>(false)
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  useEffect(() => {
    if (emailFeaturePaused) {
      setLoading(false)
      setMessages([])
      setError(null)
      setGoogleDisconnected(false)
      return
    }

    if (!contact_email) {
      setLoading(false)
      setMessages([])
      return
    }

    let cancelled = false
    const email = contact_email

    async function loadMessages() {
      setLoading(true)
      setError(null)
      setGoogleDisconnected(false)

      try {
        const response = await fetch(
          `/api/gmail/messages?contact_email=${encodeURIComponent(email)}`
        )
        const data = await response.json()

        if (!response.ok) {
          if (response.status === 409 || data.error === 'No Google account connected') {
            if (!cancelled) {
              setGoogleDisconnected(true)
              setMessages([])
            }
            return
          }

          throw new Error(data.error || 'Failed to load emails')
        }

        if (!cancelled) {
          const nextMessages = (data.messages ?? []) as ThreadMessage[]
          nextMessages.sort(
            (a, b) =>
              new Date(getMessageDate(b)).getTime() - new Date(getMessageDate(a)).getTime()
          )
          setMessages(nextMessages)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load emails')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadMessages()

    return () => {
      cancelled = true
    }
  }, [contact_email, emailFeaturePaused])

  const threads = useMemo(() => {
    const groups = new Map<
      string,
      { id: string; latestAt: string; messages: ThreadMessage[] }
    >()

    for (const message of messages) {
      const threadId = message.gmail_thread_id ?? message.gmail_message_id ?? crypto.randomUUID()
      const existing = groups.get(threadId)
      const messageDate = getMessageDate(message)

      if (existing) {
        existing.messages.push(message)
        if (new Date(messageDate).getTime() > new Date(existing.latestAt).getTime()) {
          existing.latestAt = messageDate
        }
      } else {
        groups.set(threadId, { id: threadId, latestAt: messageDate, messages: [message] })
      }
    }

    return Array.from(groups.values())
      .map(group => ({
        ...group,
        messages: group.messages.sort(
          (a, b) =>
            new Date(getMessageDate(b)).getTime() - new Date(getMessageDate(a)).getTime()
        ),
      }))
      .sort(
        (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime()
      )
  }, [messages])

  async function handleSend() {
    if (emailFeaturePaused) {
      setSendError('Email integration is temporarily paused.')
      return
    }

    if (!contact_email || !subject.trim() || !body.trim()) {
      setSendError('Subject and body are required.')
      return
    }

    setSending(true)
    setSendError(null)

    // Resolve the thread to reply into from context: the open thread if one is
    // expanded, else the most recent conversation. Only use a REAL Gmail thread
    // id (the grouping falls back to message-id / random uuid when absent, which
    // must not be sent as a threadId). Null → starts a new thread.
    const targetThread = (expandedThreadId ? threads.find((t) => t.id === expandedThreadId) : undefined) ?? threads[0]
    const replyToThreadId = targetThread?.messages.find((m) => m.gmail_thread_id)?.gmail_thread_id ?? null

    try {
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: contact_email,
          subject: subject.trim(),
          body: body.trim(),
          contact_id: contact_id ?? null,
          account_id: account_id ?? null,
          enquiry_id: enquiry_id ?? null,
          quote_id: quote_id ?? null,
          reply_to_message_id: replyToThreadId,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email')
      }

      const sentAt = new Date().toISOString()
      const messageId = data.message_id ?? crypto.randomUUID()
      const threadId = data.thread_id ?? messageId

      setMessages(current => [
        {
          gmail_message_id: messageId,
          gmail_thread_id: threadId,
          from_address: 'You',
          to_addresses: [contact_email],
          subject: subject.trim(),
          snippet: body.trim().slice(0, 200),
          body_html: body.trim(),
          sent_at: sentAt,
        },
        ...current,
      ])
      setExpandedThreadId(threadId)
      setSubject('')
      setBody('')
      setComposing(false)
    } catch (sendEmailError) {
      setSendError(
        sendEmailError instanceof Error ? sendEmailError.message : 'Failed to send email'
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <section className={embedded ? 'space-y-0' : 'os-card p-6'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {!embedded ? <h2 className="os-section-title">{title}</h2> : null}
          {!embedded ? (
            <p className="mt-1 text-sm text-[color:var(--text-2)]">
              Gmail conversation history for this contact.
            </p>
          ) : null}
        </div>
        {!emailFeaturePaused ? (
          <button
            type="button"
            onClick={() => {
              setComposing(current => !current)
              setSendError(null)
            }}
            disabled={!contact_email}
            className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent-strong)] disabled:opacity-50"
          >
            {composing ? 'Close compose' : 'Compose'}
          </button>
        ) : null}
      </div>

      {!contact_email ? (
        <div className="mt-6 rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
          No contact email is available for this record yet.
        </div>
      ) : null}

      {contact_email && emailFeaturePaused ? (
        <div className="mt-6 rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-8 text-center">
          <p className="text-sm text-[color:var(--text-2)]">Email integration is temporarily paused.</p>
          <p className="mt-2 text-sm text-[color:var(--text-2)]">
            Gmail access has been removed for now while Google verification is being simplified.
          </p>
        </div>
      ) : null}

      {contact_email && googleDisconnected ? (
        <div className="mt-6 rounded-3xl border border-[color:var(--border)] bg-[var(--accent-dim)] px-4 py-8 text-center">
          <p className="text-sm text-[color:var(--accent-strong)]">Connect Google to see emails.</p>
        </div>
      ) : null}

      {contact_email && !emailFeaturePaused && loading ? (
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map(item => (
            <div
              key={item}
              className="animate-pulse rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)] p-4"
            >
              <div className="h-4 w-1/3 rounded bg-[var(--surface-3)]" />
              <div className="mt-3 h-3 w-2/3 rounded bg-[var(--surface-3)]" />
              <div className="mt-2 h-3 w-1/2 rounded bg-[var(--surface-3)]" />
            </div>
          ))}
        </div>
      ) : null}

      {contact_email && !emailFeaturePaused && !loading && !googleDisconnected && error ? (
        <div className="mt-6 rounded-3xl border border-[color:var(--border)] bg-[var(--red-dim)] px-4 py-8 text-center text-sm text-[color:var(--red-strong)]">
          {error}
        </div>
      ) : null}

      {contact_email &&
      !emailFeaturePaused &&
      !loading &&
      !googleDisconnected &&
      !error &&
      threads.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
          No emails yet with this contact.
        </div>
      ) : null}

      {contact_email && !emailFeaturePaused && !loading && !googleDisconnected && !error && threads.length > 0 ? (
        <div className="mt-6 space-y-3">
          {threads.map(thread => {
            const latestMessage = thread.messages[0]
            const expanded = expandedThreadId === thread.id

            return (
              <div
                key={thread.id}
                className="overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[var(--surface-2)]"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedThreadId(current => (current === thread.id ? null : thread.id))
                  }
                  className="w-full px-4 py-4 text-left transition hover:bg-[var(--surface-3)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[color:var(--text)]">
                        {latestMessage.subject || '(No subject)'}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--text-3)]">
                        {latestMessage.from_address || 'Unknown sender'} to{' '}
                        {(latestMessage.to_addresses ?? []).join(', ') || 'Unknown recipient'}
                      </p>
                      <p className="mt-2 text-sm text-[color:var(--text-2)]">
                        {latestMessage.snippet || 'No preview available'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[color:var(--text-3)]">{formatDate(thread.latestAt)}</p>
                      <p className="mt-2 text-xs text-[color:var(--text-2)]">
                        {thread.messages.length} message{thread.messages.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                </button>

                {expanded ? (
                  <div className="border-t border-[color:var(--border)] px-4 py-4">
                    <div className="space-y-4">
                      {thread.messages.map(message => (
                        <article
                          key={message.gmail_message_id ?? `${thread.id}-${getMessageDate(message)}`}
                          className="rounded-[1.5rem] border border-[color:var(--border)] bg-white p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-[color:var(--text)]">
                                {message.subject || '(No subject)'}
                              </p>
                              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--text-3)]">
                                {message.from_address || 'Unknown sender'}
                              </p>
                              <p className="mt-1 text-xs text-[color:var(--text-3)]">
                                To {(message.to_addresses ?? []).join(', ') || 'Unknown recipient'}
                              </p>
                            </div>
                            <p className="text-xs text-[color:var(--text-3)]">
                              {formatDate(getMessageDate(message))}
                            </p>
                          </div>
                          {message.body_html ? (
                            <div className="mt-4">
                              <SafeEmailHtml html={message.body_html} />
                            </div>
                          ) : (
                            <p className="mt-4 whitespace-pre-wrap text-sm text-[color:var(--text-2)]">
                              {message.body_text || message.snippet || 'No message body available'}
                            </p>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}

      {contact_email && !emailFeaturePaused && composing ? (
        <div className="mt-6 rounded-[1.75rem] border border-[color:var(--border)] bg-[var(--surface-2)] p-5">
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--text-2)]">To</span>
              <input
                value={contact_email}
                readOnly
                className="os-input text-[color:var(--text-2)]"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--text-2)]">Subject</span>
              <input
                value={subject}
                onChange={event => setSubject(event.target.value)}
                className="os-input"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--text-2)]">Body</span>
              <textarea
                value={body}
                onChange={event => setBody(event.target.value)}
                rows={8}
                className="os-textarea"
              />
            </label>

            {sendError ? <p className="text-sm text-[color:var(--red-strong)]">{sendError}</p> : null}

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setComposing(false)
                  setSendError(null)
                }}
                className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent-strong)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
