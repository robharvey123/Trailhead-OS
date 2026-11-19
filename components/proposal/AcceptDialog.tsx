'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { PublicQuote, PublicQuoteAcceptance } from '@/lib/types'
import { gbp } from '@/lib/quotes/format'
import type { SelectionTotals } from '@/lib/quotes/selection'

interface AcceptDialogProps {
  open: boolean
  onClose: (accepted: boolean) => void
  token: string
  quote: PublicQuote
  selected: string[]
  totals: SelectionTotals
}

const field =
  'w-full rounded-[var(--radius-control)] border border-[color:var(--border-light)] bg-white px-3 py-2.5 text-base text-[color:var(--text)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--focus)]'
const label = 'mb-1 block text-sm font-medium text-[color:var(--text)]'
const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]'

type Phase =
  | { kind: 'form'; error: string | null; stale: boolean }
  | { kind: 'sending' }
  | { kind: 'done'; acceptance: PublicQuoteAcceptance }

/**
 * Native <dialog> (focus trap, Escape and inert background for free). On a
 * phone it fills the screen and scrolls, so the form stays usable with the
 * keyboard open.
 */
export default function AcceptDialog({ open, onClose, token, quote, selected, totals }: AcceptDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [authorised, setAuthorised] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'form', error: null, stale: false })

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const counted = new Set(totals.counted_ids)
  const chosen = quote.items.filter((item) => counted.has(item.id))
  const company = quote.prepared_for.company ?? 'your business'
  const accepted = phase.kind === 'done'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPhase({ kind: 'sending' })
    try {
      const response = await fetch(`/api/proposal/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer_name: name,
          signer_email: email,
          signer_role: role || null,
          selected_line_item_ids: selected,
          seen_updated_at: quote.updated_at,
          confirm: true,
        }),
      })
      const body = (await response.json().catch(() => null)) as
        | { ok: true; acceptance: PublicQuoteAcceptance }
        | { error?: string; state?: string }
        | null
      if (response.ok && body && 'acceptance' in body) {
        setPhase({ kind: 'done', acceptance: body.acceptance })
        return
      }
      const message = (body && 'error' in body && body.error) || 'Something went wrong. Please try again.'
      setPhase({ kind: 'form', error: message, stale: response.status === 409 })
    } catch {
      setPhase({ kind: 'form', error: 'Could not reach the server. Check your connection and try again.', stale: false })
    }
  }

  const firstName = name.trim().split(/\s+/)[0] || 'there'

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      onClose={() => onClose(accepted)}
      className="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-[color:var(--navy)]/60 sm:m-auto sm:h-auto sm:max-h-[90vh] sm:max-w-lg"
    >
      <div className="thmock flex h-full flex-col overflow-y-auto bg-white sm:h-auto sm:rounded-[var(--radius-card)]">
        {phase.kind === 'done' ? (
          <div className="p-6 text-center sm:p-8" role="status">
            <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--green-dim)] text-[color:var(--green-strong)]">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
                <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 id={`${id}-title`} className="mb-2 font-[family-name:var(--serif)] text-2xl font-bold text-[color:var(--text)]">
              Thanks {firstName}.
            </h2>
            <p className="mb-6 text-sm text-[color:var(--text-2)]">
              Rob will be in touch within one working day to agree a start date. A confirmation is on its way to {email}.
            </p>
            <div className="space-y-2">
              <a
                href={`/api/proposal/${token}/pdf`}
                className={`inline-flex w-full items-center justify-center rounded-[var(--radius-pill)] bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-[color:var(--on-accent)] hover:bg-[color:var(--blue-bright)] ${focusRing}`}
              >
                Download signed PDF
              </a>
              <button
                type="button"
                onClick={() => ref.current?.close()}
                className={`inline-flex w-full items-center justify-center rounded-[var(--radius-pill)] border border-[color:var(--border-light)] px-5 py-3 text-sm font-semibold text-[color:var(--text)] hover:bg-[color:var(--surface-2)] ${focusRing}`}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--border)] px-6 py-4">
              <h2 id={`${id}-title`} className="font-[family-name:var(--serif)] text-xl font-bold text-[color:var(--text)]">
                Accept proposal
              </h2>
              <button
                type="button"
                onClick={() => ref.current?.close()}
                aria-label="Close"
                className={`-mr-2 rounded-full p-2 text-[color:var(--text-3)] hover:bg-[color:var(--surface-2)] ${focusRing}`}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-5 px-6 py-5">
              <div className="rounded-[var(--radius-control)] bg-[color:var(--surface)] p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--text-3)]">You are accepting</p>
                <ul className="mb-3 space-y-1 text-sm text-[color:var(--text-2)]">
                  {chosen.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span>{item.title}</span>
                      <span className="shrink-0 tabular-nums">{item.included ? 'Included' : gbp(item.line_total)}</span>
                    </li>
                  ))}
                </ul>
                {quote.vat_rate > 0 ? (
                  <p className="flex justify-between text-sm text-[color:var(--text-2)]">
                    <span>VAT ({quote.vat_rate}%)</span>
                    <span className="tabular-nums">{gbp(totals.vat_amount)}</span>
                  </p>
                ) : null}
                <p className="flex justify-between border-t border-[color:var(--border)] pt-2 text-base font-semibold text-[color:var(--text)]">
                  <span>Total</span>
                  <span className="tabular-nums">{gbp(totals.total)}</span>
                </p>
              </div>

              <div>
                <label htmlFor={`${id}-name`} className={label}>
                  Full name
                </label>
                <input id={`${id}-name`} required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
              </div>
              <div>
                <label htmlFor={`${id}-email`} className={label}>
                  Email
                </label>
                <input id={`${id}-email`} type="email" required maxLength={200} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
              </div>
              <div>
                <label htmlFor={`${id}-role`} className={label}>
                  Role <span className="font-normal text-[color:var(--text-3)]">(optional)</span>
                </label>
                <input id={`${id}-role`} maxLength={120} autoComplete="organization-title" value={role} onChange={(e) => setRole(e.target.value)} className={field} />
              </div>
              <label className="flex items-start gap-3 text-sm text-[color:var(--text-2)]">
                <input
                  type="checkbox"
                  required
                  checked={authorised}
                  onChange={(e) => setAuthorised(e.target.checked)}
                  // ! beats the OS-wide unlayered 44px-target rule (.thmock input[type=checkbox],
                  // margin -10px), which pulled this box past the card's left edge on phones.
                  className="!m-0 mt-0.5 !h-5 !w-5 shrink-0 accent-[color:var(--accent)]"
                />
                <span>I&apos;m authorised to accept this on behalf of {company}.</span>
              </label>

              {phase.kind === 'form' && phase.error ? (
                <div role="alert" className="rounded-[var(--radius-control)] bg-[color:var(--red-dim)] p-3 text-sm text-[color:var(--red-strong)]">
                  <p>{phase.error}</p>
                  {phase.stale ? (
                    <button type="button" onClick={() => window.location.reload()} className={`mt-2 font-semibold underline ${focusRing}`}>
                      Refresh now
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 border-t border-[color:var(--border)] bg-white px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button
                type="submit"
                disabled={phase.kind === 'sending' || !authorised}
                className={`inline-flex w-full items-center justify-center rounded-[var(--radius-pill)] bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-[color:var(--on-accent)] hover:bg-[color:var(--blue-bright)] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
              >
                {phase.kind === 'sending' ? 'Confirming…' : 'Accept and confirm'}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  )
}
