'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PublicQuote } from '@/lib/types'
import { gbp, longDate, noteLines, shortDate } from '@/lib/quotes/format'
import { selectionTotals } from '@/lib/quotes/selection'
import FeatureCard from './FeatureCard'
import QuestionForm from './QuestionForm'
import { useCountUp } from './useCountUp'

export interface ProposalContact {
  phoneLabel: string
  phoneHref: string
  whatsappHref: string
}

interface ProposalViewProps {
  quote: PublicQuote
  /** null in preview: there is no public link yet. */
  token: string | null
  initialSelected: string[]
  mode: 'live' | 'preview'
  contact: ProposalContact
}

const STEPS = ['Accept online', 'We confirm the start date', 'Built and reviewed with you', 'Signed off']

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]'
const primaryButton = `inline-flex w-full items-center justify-center rounded-[var(--radius-pill)] bg-[color:var(--accent)] px-5 py-3 text-sm font-semibold text-[color:var(--on-accent)] transition-colors hover:bg-[color:var(--blue-bright)] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`
const secondaryButton = `inline-flex w-full items-center justify-center rounded-[var(--radius-pill)] border border-[color:var(--border-light)] bg-white px-5 py-3 text-sm font-semibold text-[color:var(--text)] transition-colors hover:bg-[color:var(--surface-2)] ${focusRing}`

export default function ProposalView({ quote, token, initialSelected, mode, contact }: ProposalViewProps) {
  const locked = quote.state === 'accepted' || quote.state === 'declined'
  const [selected, setSelected] = useState<string[]>(initialSelected)
  const [questionPrefill, setQuestionPrefill] = useState<string | null>(null)
  const questionsRef = useRef<HTMLElement>(null)

  const paidItems = quote.items.filter((item) => !item.included)
  const includedItems = quote.items.filter((item) => item.included)
  const optionalItems = quote.items.filter((item) => item.optional)
  const numberOf = useMemo(() => new Map(quote.items.map((item, index) => [item.id, index + 1])), [quote.items])

  const totals = useMemo(() => selectionTotals(quote.items, selected, quote.vat_rate), [quote.items, quote.vat_rate, selected])
  const pricedTotal = paidItems.length
  const pricedChosen = paidItems.filter((item) => totals.counted_ids.includes(item.id)).length
  const animatedTotal = useCountUp(totals.total)

  // Keep the choice in the URL so a refresh or a forwarded link keeps it.
  useEffect(() => {
    if (mode !== 'live' || locked) return
    const url = new URL(window.location.href)
    url.searchParams.set('sel', selected.join(','))
    window.history.replaceState(null, '', url.toString())
  }, [selected, mode, locked])

  const toggle = useCallback(
    (id: string) => {
      if (locked) return
      setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))
    },
    [locked]
  )

  const pdfHref = token
    ? `/api/proposal/${token}/pdf${quote.state === 'accepted' ? '' : `?sel=${encodeURIComponent(selected.join(','))}`}`
    : null

  const askForUpdate = () => {
    setQuestionPrefill(
      `Hi Rob, proposal ${quote.quote_number} has expired. Could you send me an updated quote? I'm interested in: ${paidItems
        .filter((item) => totals.counted_ids.includes(item.id))
        .map((item) => item.title)
        .join(', ')}.`
    )
    questionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const company = quote.prepared_for.company
  const clientNotes = noteLines(quote.client_notes)
  const companyEmail = quote.company.email

  const summary = (
    <SummaryCard
      quote={quote}
      chosen={pricedChosen}
      of={pricedTotal}
      subtotal={totals.subtotal}
      vat={totals.vat_amount}
      total={totals.total}
      animatedTotal={animatedTotal}
      mode={mode}
      pdfHref={pdfHref}
      canAccept={quote.state === 'open' && mode === 'live' && totals.priced_count > 0}
      onAskForUpdate={askForUpdate}
    />
  )

  return (
    <div className="thmock min-h-screen bg-[color:var(--surface)] pb-[calc(9rem+env(safe-area-inset-bottom))] lg:pb-0 print:bg-white print:pb-0">
      {mode === 'preview' ? (
        <div className="sticky top-0 z-40 bg-[color:var(--amber)] px-4 py-2 text-center text-sm font-semibold text-[color:var(--navy)] print:hidden">
          Preview, not yet shared. Accept is disabled.
        </div>
      ) : null}

      {/* 1. Hero */}
      <header className="th-dark bg-[color:var(--navy)] text-white print:bg-white print:text-[color:var(--navy)]">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 md:pb-16 lg:px-8">
          <div className="mb-10 flex flex-wrap items-start justify-between gap-4 md:mb-14">
            <Image src="/logo-dark.svg" alt="Trailhead" width={148} height={32} priority className="h-8 w-auto print:hidden" />
            <div className="text-right text-sm text-[color:var(--text-2)]">
              <p className="font-[family-name:var(--mono)] text-[color:var(--text)]">{quote.quote_number}</p>
              {quote.valid_until ? <p>Valid until {shortDate(quote.valid_until)}</p> : null}
            </div>
          </div>

          {quote.state === 'accepted' && quote.acceptance ? (
            <StateBanner tone="green">
              Accepted by {quote.acceptance.signer_name} on {longDate(quote.acceptance.accepted_at)}
            </StateBanner>
          ) : null}
          {quote.state === 'expired' && quote.valid_until ? (
            <StateBanner tone="amber">This proposal expired on {longDate(quote.valid_until)}</StateBanner>
          ) : null}
          {quote.state === 'declined' ? (
            <StateBanner tone="grey">This proposal was declined. Changed your mind? Get in touch below.</StateBanner>
          ) : null}

          {quote.prepared_for.contact_first_name ? (
            <p className="mb-3 text-base text-[color:var(--text-2)]">
              Hi {quote.prepared_for.contact_first_name}, here&apos;s what we talked about.
            </p>
          ) : null}
          {company ? (
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--accent-strong)]">
              Proposal for {company}
            </p>
          ) : null}
          <h1 className="max-w-3xl font-[family-name:var(--serif)] text-3xl font-bold leading-tight tracking-tight md:text-5xl">
            {quote.title}
          </h1>
          {quote.summary ? (
            <p className="mt-5 max-w-[65ch] whitespace-pre-line text-base leading-relaxed text-[color:var(--text-2)] md:text-lg">
              {quote.summary}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8 lg:px-8">
        <main className="min-w-0">
          {/* 2. Build your package */}
          <section aria-labelledby="package-heading" className="pt-10 md:pt-14">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="package-heading" className="font-[family-name:var(--serif)] text-2xl font-bold text-[color:var(--text)]">
                  {locked ? 'Your package' : 'Build your package'}
                </h2>
                {!locked && optionalItems.length > 0 ? (
                  <p className="mt-1 text-sm text-[color:var(--text-2)]">
                    Switch features on or off. Your total updates as you go.
                  </p>
                ) : null}
              </div>
              {!locked && optionalItems.length >= 3 ? (
                <div className="flex gap-4 text-sm print:hidden">
                  <button
                    type="button"
                    onClick={() => setSelected(optionalItems.map((item) => item.id))}
                    className={`rounded font-medium text-[color:var(--accent-strong)] hover:underline ${focusRing}`}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected([])}
                    className={`rounded font-medium text-[color:var(--accent-strong)] hover:underline ${focusRing}`}
                  >
                    Clear
                  </button>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paidItems.map((item) => (
                <FeatureCard
                  key={item.id}
                  item={item}
                  number={numberOf.get(item.id) ?? 0}
                  selected={selected.includes(item.id)}
                  locked={locked}
                  onToggle={toggle}
                />
              ))}
            </div>

            {includedItems.length > 0 ? (
              <>
                <h3 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--text-3)]">
                  Included at no charge
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {includedItems.map((item) => (
                    <FeatureCard
                      key={item.id}
                      item={item}
                      number={numberOf.get(item.id) ?? 0}
                      selected
                      locked
                      onToggle={toggle}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </section>

          {/* 4. How it works */}
          <section aria-labelledby="how-heading" className="pt-12">
            <h2 id="how-heading" className="mb-5 font-[family-name:var(--serif)] text-2xl font-bold text-[color:var(--text)]">
              How it works
            </h2>
            <ol className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step} className="os-card flex items-center gap-3 p-4">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--navy)] text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium text-[color:var(--text)]">{step}</span>
                </li>
              ))}
            </ol>
            {quote.payment_terms || quote.estimated_timeline ? (
              <div className="os-card space-y-3 p-5 text-sm text-[color:var(--text-2)]">
                {quote.estimated_timeline ? (
                  <p>
                    <span className="font-semibold text-[color:var(--text)]">Timeline: </span>
                    {quote.estimated_timeline}
                  </p>
                ) : null}
                {quote.payment_terms ? <p className="whitespace-pre-line">{quote.payment_terms}</p> : null}
              </div>
            ) : null}
          </section>

          {/* 5. Good to know */}
          {clientNotes.length > 0 ? (
            <section aria-labelledby="notes-heading" className="pt-12">
              <h2 id="notes-heading" className="mb-5 font-[family-name:var(--serif)] text-2xl font-bold text-[color:var(--text)]">
                Good to know
              </h2>
              <ul className="os-card space-y-2.5 p-5">
                {clientNotes.map((line, index) => (
                  <li key={index} className="flex gap-2.5 text-sm text-[color:var(--text-2)]">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--accent)]" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 6. Questions */}
          <section ref={questionsRef} aria-labelledby="questions-heading" className="scroll-mt-6 pb-12 pt-12 print:hidden">
            <h2 id="questions-heading" className="mb-2 font-[family-name:var(--serif)] text-2xl font-bold text-[color:var(--text)]">
              Questions?
            </h2>
            <p className="mb-5 text-sm text-[color:var(--text-2)]">
              Ask anything and Rob will reply by email. Or{' '}
              {companyEmail ? (
                <>
                  email{' '}
                  <a href={`mailto:${companyEmail}?subject=${encodeURIComponent(quote.quote_number)}`} className="font-medium text-[color:var(--accent-strong)] underline underline-offset-2">
                    {companyEmail}
                  </a>{' '}
                  or{' '}
                </>
              ) : null}
              call{' '}
              <a href={contact.phoneHref} className="font-medium text-[color:var(--accent-strong)] underline underline-offset-2">
                {contact.phoneLabel}
              </a>
              .
            </p>
            <QuestionForm
              key={questionPrefill ?? 'blank'}
              token={token}
              disabled={mode !== 'live'}
              prefill={questionPrefill}
            />
          </section>
        </main>

        {/* 3. Summary: sticky card at lg */}
        <aside className="hidden lg:block print:hidden" aria-label="Your total">
          <div className="sticky top-6 pt-14">{summary}</div>
        </aside>
      </div>

      {/* 3. Summary: fixed bar on mobile and tablet */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[color:var(--border)] bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-lg)] backdrop-blur lg:hidden print:hidden">
        <MobileBar
          quote={quote}
          chosen={pricedChosen}
          of={pricedTotal}
          animatedTotal={animatedTotal}
          vat={totals.vat_amount}
          mode={mode}
          pdfHref={pdfHref}
          canAccept={quote.state === 'open' && mode === 'live' && totals.priced_count > 0}
          onAskForUpdate={askForUpdate}
        />
      </div>

      {/* Announce total changes once, not on every animation frame. */}
      <p aria-live="polite" className="sr-only">
        Total {gbp(totals.total)}, {pricedChosen} of {pricedTotal} features.
      </p>

      {/* 7. Footer */}
      <footer className="border-t border-[color:var(--border)] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-[color:var(--text-3)] sm:px-6 lg:px-8">
          <p className="font-semibold text-[color:var(--text-2)]">{quote.company.name}</p>
          <p>
            {quote.company.number ? `Company number ${quote.company.number}. ` : ''}Registered in England and Wales.
          </p>
          {companyEmail ? (
            <p>
              <a href={`mailto:${companyEmail}`} className="underline underline-offset-2 hover:text-[color:var(--text)]">
                {companyEmail}
              </a>
            </p>
          ) : null}
          <p className="mt-2">Prepared by Rob Harvey.</p>
        </div>
      </footer>
    </div>
  )
}

function StateBanner({ tone, children }: { tone: 'green' | 'amber' | 'grey'; children: React.ReactNode }) {
  const tones = {
    green: 'bg-[color:var(--green-dim)] text-[color:var(--green-strong)]',
    amber: 'bg-[color:var(--amber-dim)] text-[color:var(--amber-strong)]',
    grey: 'bg-[color:var(--grey-dim)] text-[color:var(--grey-strong)]',
  }
  return (
    <p role="status" className={`mb-6 inline-flex rounded-[var(--radius-control)] px-3 py-2 text-sm font-semibold ${tones[tone]}`}>
      {children}
    </p>
  )
}

interface SummaryProps {
  quote: PublicQuote
  chosen: number
  of: number
  animatedTotal: number
  vat: number
  mode: 'live' | 'preview'
  pdfHref: string | null
  canAccept: boolean
  onAskForUpdate: () => void
}

function Actions({ quote, mode, pdfHref, canAccept, onAskForUpdate, compact }: Pick<SummaryProps, 'quote' | 'mode' | 'pdfHref' | 'canAccept' | 'onAskForUpdate'> & { compact?: boolean }) {
  const accepted = quote.state === 'accepted'
  const pdfLabel = accepted ? 'Download signed PDF' : 'Download PDF'
  const pdf = pdfHref ? (
    <a href={pdfHref} className={secondaryButton}>
      {pdfLabel}
    </a>
  ) : (
    <button type="button" disabled className={`${secondaryButton} opacity-60`}>
      {pdfLabel}
    </button>
  )

  let primary: React.ReactNode = null
  if (quote.state === 'expired') {
    primary = (
      <button type="button" onClick={onAskForUpdate} className={primaryButton}>
        Ask for an updated quote
      </button>
    )
  } else if (quote.state === 'open' || mode === 'preview') {
    primary = (
      <button type="button" disabled={!canAccept} className={primaryButton} data-action="accept">
        Accept proposal
      </button>
    )
  }

  if (accepted) return <div className={compact ? '' : 'space-y-2'}>{pdfHref ? <a href={pdfHref} className={primaryButton}>{pdfLabel}</a> : pdf}</div>

  return (
    <div className={compact ? 'grid grid-cols-[1fr_auto] gap-2' : 'space-y-2'}>
      {primary}
      {compact ? (
        pdfHref ? (
          <a href={pdfHref} className={`${secondaryButton} px-4`} aria-label="Download PDF">
            PDF
          </a>
        ) : null
      ) : (
        pdf
      )}
    </div>
  )
}

function SummaryCard(props: SummaryProps & { subtotal: number; total: number }) {
  const { quote, chosen, of, subtotal, vat, animatedTotal } = props
  return (
    <div className="os-card p-5">
      <p className="mb-4 text-sm font-medium text-[color:var(--text-2)]">
        {chosen} of {of} features
      </p>
      <dl className="mb-4 space-y-1.5 border-b border-[color:var(--border)] pb-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-[color:var(--text-2)]">Subtotal</dt>
          <dd className="tabular-nums text-[color:var(--text)]">{gbp(subtotal)}</dd>
        </div>
        {quote.vat_rate > 0 ? (
          <div className="flex justify-between">
            <dt className="text-[color:var(--text-2)]">VAT ({quote.vat_rate}%)</dt>
            <dd className="tabular-nums text-[color:var(--text)]">{gbp(vat)}</dd>
          </div>
        ) : null}
      </dl>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--text-3)]">Total</p>
      <p className="mb-5 font-[family-name:var(--serif)] text-4xl font-bold tabular-nums text-[color:var(--text)]">
        {gbp(animatedTotal)}
      </p>
      <Actions {...props} />
    </div>
  )
}

function MobileBar(props: SummaryProps) {
  const { quote, chosen, of, vat, animatedTotal } = props
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <p className="text-sm text-[color:var(--text-2)]">
          {chosen} of {of} features
          {quote.vat_rate > 0 ? <span className="block text-xs">incl. {gbp(vat)} VAT</span> : null}
        </p>
        <p className="font-[family-name:var(--serif)] text-2xl font-bold tabular-nums text-[color:var(--text)]">{gbp(animatedTotal)}</p>
      </div>
      <Actions {...props} compact />
    </div>
  )
}
