'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { gbp } from '@/lib/quotes/format'
import type { QuoteAcceptance, QuoteEvent, QuoteEventType, QuoteListItem } from '@/lib/types'
import RecordEmailDialog from './RecordEmailDialog'

export interface ClientPageData {
  publicUrl: string | null
  gateFailures: string[]
  events: QuoteEvent[]
  acceptance: QuoteAcceptance | null
  /** line item id → title, for the accepted list. */
  itemTitles: Record<string, string>
}

const EVENT_LABEL: Record<QuoteEventType, string> = {
  published: 'Published',
  revoked: 'Link revoked',
  viewed: 'Opened by the client',
  pdf_downloaded: 'PDF downloaded',
  question: 'Question asked',
  accepted: 'Accepted',
  declined: 'Declined',
}

function when(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  }).format(new Date(value))
}

function eventDetail(event: QuoteEvent): string | null {
  const meta = event.meta ?? {}
  if (event.type === 'question' && typeof meta.name === 'string') return `${meta.name}: ${String(meta.message ?? '').slice(0, 90)}`
  if (event.type === 'declined' && typeof meta.reason === 'string') return `Reason: ${meta.reason}`
  if (event.type === 'accepted') return meta.manual ? 'Recorded in the OS' : typeof meta.signer_name === 'string' ? meta.signer_name : null
  if (event.type === 'published' && meta.regenerated) return 'New link'
  return null
}

/** Right-column "Client page" panel on the quote detail: publish, share, revoke, activity. */
export default function QuoteClientPagePanel({ quote, data }: { quote: QuoteListItem; data: ClientPageData }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [failures, setFailures] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  const published = Boolean(data.publicUrl)
  const locked = quote.status === 'accepted' || quote.status === 'converted' || quote.status === 'declined'
  const firstName = quote.contact?.name?.trim().split(/\s+/)[0]

  async function call(action: 'publish' | 'regenerate' | 'revoke') {
    if (action === 'revoke' && !window.confirm('Revoke this link? The client will see "This link is no longer active" until you publish again.')) return
    if (action === 'regenerate' && !window.confirm('Make a new link? The current link stops working straight away.')) return
    setBusy(action)
    setError(null)
    setFailures([])
    try {
      if (action === 'revoke') {
        await apiFetch(`/api/quotes/${quote.id}/revoke`, { method: 'POST' })
      } else {
        const response = await fetch(`/api/quotes/${quote.id}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ regenerate: action === 'regenerate' }),
        })
        const body = (await response.json().catch(() => null)) as { error?: string; failures?: string[] } | null
        if (!response.ok) {
          setFailures(body?.failures ?? [])
          setError(body?.error ?? 'Could not publish')
          return
        }
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  async function copy() {
    if (!data.publicUrl) return
    try {
      await navigator.clipboard.writeText(data.publicUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copy failed. Select the link and copy it by hand.')
    }
  }

  const views = quote.view_count ?? 0
  const shownFailures = failures.length > 0 ? failures : published || locked ? [] : data.gateFailures
  const acceptance = data.acceptance

  return (
    <div className="os-card p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="os-eyebrow">Client page</p>
        <span
          className={`rounded-pill px-2.5 py-0.5 text-xs font-semibold ${published ? 'bg-[var(--green-dim)] text-[color:var(--green-strong)]' : 'bg-[var(--grey-dim)] text-[color:var(--grey-strong)]'}`}
        >
          {published ? 'Live' : 'Not shared'}
        </span>
      </div>

      {acceptance ? (
        <div className="mt-4 rounded-card border border-[color:var(--green)] bg-[var(--green-dim)] p-4 text-sm">
          <p className="font-semibold text-[color:var(--green-strong)]">
            Accepted by {acceptance.signer_name}
            {acceptance.signer_role ? `, ${acceptance.signer_role}` : ''}
          </p>
          <p className="text-[color:var(--text-2)]">
            {when(acceptance.accepted_at)}
            {acceptance.meta?.manual ? ' · recorded in the OS' : ' · online'}
            {acceptance.signer_email && acceptance.signer_email !== 'not recorded' ? ` · ${acceptance.signer_email}` : ''}
          </p>
          <ul className="mt-2 space-y-0.5 text-[color:var(--text-2)]">
            {acceptance.selected_line_item_ids.map((id) => (
              <li key={id}>• {data.itemTitles[id] ?? 'Removed item'}</li>
            ))}
          </ul>
          <p className="mt-2 font-semibold text-[color:var(--text)]">Total {gbp(Number(acceptance.total))}</p>
        </div>
      ) : null}

      {published && data.publicUrl ? (
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <input
              readOnly
              value={data.publicUrl}
              onFocus={(event) => event.currentTarget.select()}
              aria-label="Client page link"
              className="os-input min-w-0 flex-1 font-[family-name:var(--mono)] text-xs"
            />
            <button type="button" onClick={() => void copy()} className="btn btn-ghost shrink-0">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a href={data.publicUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-full">
              Open
            </a>
            {quote.contact?.email ? (
              <RecordEmailDialog
                kind="quote"
                recordId={quote.id}
                buttonLabel="Send to client"
                dialogTitle="Send proposal to client"
                defaultRecipient={quote.contact.email}
                defaultSubject={`Your proposal: ${quote.title}`}
                defaultMessage={`Hi${firstName ? ` ${firstName}` : ''},\n\nHere's the proposal for ${quote.title}. You can switch features on or off, see the total change as you go, and accept online when you're ready. The PDF is attached too.\n\nAny questions, just reply.\n\nBest,\nRob`}
                buttonClassName="btn btn-primary w-full"
                fullWidth
                onSent={() => router.refresh()}
              />
            ) : (
              <span className="self-center text-xs text-[color:var(--text-3)]">Add a contact email to send it.</span>
            )}
          </div>
          <div className="flex gap-4 text-sm">
            <button type="button" onClick={() => void call('regenerate')} disabled={busy !== null} className="text-[color:var(--accent-strong)] hover:underline disabled:opacity-50">
              {busy === 'regenerate' ? 'Making a new link…' : 'Regenerate link'}
            </button>
            <button type="button" onClick={() => void call('revoke')} disabled={busy !== null} className="text-[color:var(--red-strong)] hover:underline disabled:opacity-50">
              {busy === 'revoke' ? 'Revoking…' : 'Revoke link'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[color:var(--text-2)]">
            Share this quote as an interactive page: the client picks features, sees the total and accepts online.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <a href={`/quotes/${quote.id}/preview`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-full">
              Preview as client
            </a>
            <button
              type="button"
              onClick={() => void call('publish')}
              disabled={busy !== null || locked}
              className="btn btn-primary w-full"
            >
              {busy === 'publish' ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>
      )}

      {shownFailures.length > 0 ? (
        <div className="mt-4 rounded-card border border-[color:var(--amber)] bg-[var(--amber-dim)] p-3 text-sm text-[color:var(--amber-strong)]">
          <p className="font-semibold">Before you publish:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {shownFailures.map((failure) => (
              <li key={failure}>{failure}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {error && failures.length === 0 ? <p className="mt-3 text-sm text-[color:var(--red-strong)]">{error}</p> : null}

      <div className="mt-5 border-t border-[color:var(--border)] pt-4">
        <p className="os-eyebrow">Activity</p>
        <p className="mt-2 text-sm text-[color:var(--text-2)]">
          {views === 0
            ? 'Not opened yet.'
            : `Opened ${views} ${views === 1 ? 'time' : 'times'}${quote.last_viewed_at ? `, last ${when(quote.last_viewed_at)}` : ''}.`}
        </p>
        {data.events.length > 0 ? (
          <ol className="mt-3 space-y-2">
            {data.events.map((event) => {
              const detail = eventDetail(event)
              return (
                <li key={event.id} className="text-sm">
                  <span className="text-[color:var(--text)]">{EVENT_LABEL[event.type]}</span>
                  <span className="text-[color:var(--text-3)]"> · {when(event.created_at)}</span>
                  {detail ? <span className="block truncate text-xs text-[color:var(--text-3)]">{detail}</span> : null}
                </li>
              )
            })}
          </ol>
        ) : null}
      </div>
    </div>
  )
}
