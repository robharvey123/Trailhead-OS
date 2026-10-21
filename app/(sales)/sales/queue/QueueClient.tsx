'use client'

import Link from 'next/link'
import { useState } from 'react'
import OutcomeLogger from '@/components/sales/OutcomeLogger'
import { BUCKET_LABELS, OUTCOME_LABELS, STAGE_LABELS, type QueueBucket, type QueueRow } from '@/lib/sales/queue'

function fmt(v: string | null) {
  return v ? new Date(v).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
}

const BUCKETS: QueueBucket[] = ['callback', 'warm', 'trial', 'cold']

export default function QueueClient({ initialRows }: { initialRows: QueueRow[] }) {
  const [rows, setRows] = useState(initialRows)
  const [activeId, setActiveId] = useState<string | null>(initialRows[0]?.id ?? null)
  const [doneCount, setDoneCount] = useState(0)

  function advance(fromId: string) {
    const idx = rows.findIndex((r) => r.id === fromId)
    const next = rows.filter((r) => r.id !== fromId)
    setRows(next)
    setActiveId(next[Math.min(Math.max(idx, 0), next.length - 1)]?.id ?? null)
    setDoneCount((n) => n + 1)
  }

  if (rows.length === 0) {
    return (
      <div className="panel empty">
        {doneCount > 0 ? `Queue cleared: ${doneCount} logged this session.` : 'Nothing to call right now. Callbacks, follow-ups and CTPS-clear numbers will appear here.'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[color:var(--text-2)]">
        {rows.length} to call{doneCount ? ` · ${doneCount} logged this session` : ''}
      </p>
      {BUCKETS.map((bucket) => {
        const inBucket = rows.filter((r) => r.bucket === bucket)
        if (inBucket.length === 0) return null
        return (
          <section key={bucket} aria-labelledby={`bucket-${bucket}`} className="space-y-2">
            <h2 id={`bucket-${bucket}`} className="text-sm font-semibold">
              {BUCKET_LABELS[bucket]} <span className="font-normal text-[color:var(--text-3)]">{inBucket.length}</span>
            </h2>
            <ol className="space-y-2">
              {inBucket.map((r) => {
                const active = r.id === activeId
                return (
                  <li key={r.id} className={`panel p-4 ${active ? 'ring-2 ring-[var(--accent)]' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button type="button" onClick={() => setActiveId(r.id)} className="min-w-0 text-left">
                        <span className="block font-semibold">{r.company ?? r.name}</span>
                        <span className="block text-xs text-[color:var(--text-2)]">
                          {[r.name, r.role, r.sub_trade, r.city].filter(Boolean).join(' · ')}
                        </span>
                        {r.size_signal ? <span className="mt-0.5 block text-xs text-[color:var(--text-3)]">{r.size_signal}</span> : null}
                      </button>
                      <div className="flex flex-col items-end gap-1 text-right">
                        {r.phone ? (
                          <a href={`tel:${r.phone.replace(/\s+/g, '')}`} className="btn btn-primary btn-sm">Call {r.phone}</a>
                        ) : null}
                        <span className="status-badge status-prospect">{STAGE_LABELS[r.pipeline_stage]}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--text-2)]">
                      {r.bucket === 'callback' && r.next_action_at ? (
                        <span className="font-medium text-[color:var(--amber-strong)]">Callback {fmt(r.next_action_at)}{r.next_action_note ? `: ${r.next_action_note}` : ''}</span>
                      ) : null}
                      <span>Emails: {r.emailStats.sent} sent, {r.emailStats.opened} opened</span>
                      <span>
                        Last: {r.lastTouch ? `${r.lastTouch.outcome_code ? OUTCOME_LABELS[r.lastTouch.outcome_code] : r.lastTouch.subject} ${fmt(r.lastTouch.occurred_at)}` : 'no touchpoints yet'}
                      </span>
                      <Link href={`/sales/contacts/${r.id}`} className="hover:underline">Open record</Link>
                    </div>
                    {r.lastTouch?.body ? <p className="mt-1 line-clamp-2 text-xs text-[color:var(--text-3)]">{r.lastTouch.body}</p> : null}
                    {active ? (
                      <div className="mt-3 border-t border-[var(--border)] pt-3">
                        <OutcomeLogger contactId={r.id} onLogged={() => advance(r.id)} />
                      </div>
                    ) : (
                      <button type="button" onClick={() => setActiveId(r.id)} className="mt-2 text-xs text-[color:var(--accent-strong)] hover:underline">
                        Log an outcome
                      </button>
                    )}
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}
    </div>
  )
}
