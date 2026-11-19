'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import type { PublicQuoteItem } from '@/lib/types'
import { gbp } from '@/lib/quotes/format'

function Tick({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 ${className}`}>
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface FeatureCardProps {
  item: PublicQuoteItem
  number: number
  selected: boolean
  locked: boolean
  onToggle: (id: string) => void
}

/**
 * One feature on the proposal. Optional items carry a real switch and the whole
 * card toggles; required items show a Core badge; £0 items an Included badge.
 */
export default function FeatureCard({ item, number, selected, locked, onToggle }: FeatureCardProps) {
  const detailRef = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const togglable = item.optional && !locked
  const on = !item.optional || selected
  const titleId = `item-${item.id}-title`

  useLayoutEffect(() => {
    const el = detailRef.current
    if (el && !expanded) setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [item.detail, expanded])

  return (
    <article
      onClick={togglable ? () => onToggle(item.id) : undefined}
      className={[
        'group relative flex flex-col rounded-[var(--radius-card)] border bg-white p-5 transition-[opacity,border-color,box-shadow] duration-200 motion-reduce:transition-none',
        togglable ? 'cursor-pointer' : '',
        on
          ? item.optional
            ? 'border-[color:var(--accent)] shadow-[0_0_0_1px_var(--accent)]'
            : 'border-[color:var(--border)]'
          : 'border-[color:var(--border)] opacity-60 print:hidden',
      ].join(' ')}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-[var(--radius-pill)] bg-[color:var(--surface-2)] px-2 font-[family-name:var(--mono)] text-xs font-semibold text-[color:var(--text-2)]">
          {String(number).padStart(2, '0')}
        </span>
        {item.included ? (
          <span className="rounded-[var(--radius-pill)] bg-[color:var(--emerald-dim)] px-2.5 py-1 text-xs font-semibold text-[color:var(--emerald-strong)]">
            Included
          </span>
        ) : !item.optional ? (
          <span className="rounded-[var(--radius-pill)] bg-[color:var(--grey-dim)] px-2.5 py-1 text-xs font-semibold text-[color:var(--grey-strong)]">
            Core
          </span>
        ) : on ? (
          <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[color:var(--accent-dim)] px-2.5 py-1 text-xs font-semibold text-[color:var(--accent-strong)]">
            <Tick /> Added
          </span>
        ) : null}
      </div>

      <h3 id={titleId} className="mb-2 text-base font-semibold leading-snug text-[color:var(--text)]">
        {item.title}
      </h3>

      {item.detail ? (
        <div className="mb-3">
          <p
            ref={detailRef}
            className={`whitespace-pre-line text-sm leading-relaxed text-[color:var(--text-2)] ${expanded ? '' : 'line-clamp-4 print:line-clamp-none'}`}
          >
            {item.detail}
          </p>
          {overflows || expanded ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setExpanded((value) => !value)
              }}
              aria-expanded={expanded}
              className="mt-1 rounded text-sm font-medium text-[color:var(--accent-strong)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] print:hidden"
            >
              {expanded ? 'Less' : 'More'}
            </button>
          ) : null}
        </div>
      ) : null}

      {item.duration ? (
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[color:var(--text-3)]">{item.duration}</p>
      ) : null}

      {item.deliverables.length > 0 ? (
        <ul className="mb-4 space-y-1.5">
          {item.deliverables.map((deliverable) => (
            <li key={deliverable} className="flex gap-2 text-sm text-[color:var(--text-2)]">
              <Tick className="mt-0.5 text-[color:var(--green)]" />
              <span>{deliverable}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[color:var(--border)] pt-4">
        <span className="text-base font-semibold tabular-nums text-[color:var(--text)]">
          {item.included ? 'No charge' : gbp(item.line_total)}
          {!item.included && item.qty !== 1 ? (
            <span className="ml-1 text-xs font-normal text-[color:var(--text-3)]">
              ({item.qty} × {gbp(item.unit_price)})
            </span>
          ) : null}
        </span>

        {item.optional ? (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-labelledby={titleId}
            disabled={locked}
            onClick={(event) => {
              event.stopPropagation()
              if (togglable) onToggle(item.id)
            }}
            className={[
              'relative inline-flex h-7 w-12 shrink-0 items-center rounded-[var(--radius-pill)] transition-colors duration-200 motion-reduce:transition-none',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed print:hidden',
              on ? 'bg-[color:var(--accent)]' : 'bg-[color:var(--border-light)]',
            ].join(' ')}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${on ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        ) : null}
      </div>
    </article>
  )
}
