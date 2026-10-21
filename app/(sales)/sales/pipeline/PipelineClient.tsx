'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { setStage } from '../actions'
import { PIPELINE_STAGES, STAGE_LABELS, type PipelineContact, type PipelineStage } from '@/lib/sales/queue'

type Card = PipelineContact

function CardView({ c, dragging, onPick }: { c: Card; dragging?: boolean; onPick?: (to: PipelineStage) => void }) {
  return (
    <div className={`rounded-md border border-[var(--border)] bg-[var(--surface)] p-2.5 text-sm shadow-sm ${dragging ? 'opacity-60' : ''}`}>
      <Link href={`/sales/contacts/${c.id}`} className="font-medium hover:underline" onPointerDown={(e) => e.stopPropagation()}>
        {c.company ?? c.name}
      </Link>
      <p className="mt-0.5 text-xs text-[color:var(--text-3)]">{[c.name, c.sub_trade, c.city].filter(Boolean).join(' · ')}</p>
      {c.next_action_at ? (
        <p className="mt-1 text-xs text-[color:var(--amber-strong)]">
          Next: {new Date(c.next_action_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      ) : null}
      {c.pipeline_stage === 'lost' && c.lost_reason ? <p className="mt-1 text-xs text-[color:var(--text-3)]">Lost: {c.lost_reason}</p> : null}
      {c.pipeline_stage === 'disqualified' && c.disqualified_reason ? <p className="mt-1 text-xs text-[color:var(--text-3)]">DQ: {c.disqualified_reason}</p> : null}
      {onPick ? (
        // Tap alternative to dragging (iPad, keyboard, screen readers).
        <select
          aria-label={`Move ${c.company ?? c.name} to`}
          value=""
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            if (e.target.value) onPick(e.target.value as PipelineStage)
          }}
          className="mt-2 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[color:var(--text-2)]"
        >
          <option value="">Move to…</option>
          {PIPELINE_STAGES.filter((s) => s !== c.pipeline_stage).map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
      ) : null}
    </div>
  )
}

function DraggableCard({ c, onPick }: { c: Card; onPick: (to: PipelineStage) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab touch-manipulation list-none" aria-roledescription="Draggable contact">
      <CardView c={c} dragging={isDragging} onPick={onPick} />
    </li>
  )
}

function Column({ stage, cards, onPick }: { stage: PipelineStage; cards: Card[]; onPick: (id: string, to: PipelineStage) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  return (
    <section
      ref={setNodeRef}
      aria-label={`${STAGE_LABELS[stage]}, ${cards.length}`}
      className={`flex w-56 shrink-0 flex-col rounded-lg border border-[var(--border)] bg-[var(--surface-2)] ${isOver ? 'ring-2 ring-[var(--accent)]' : ''}`}
    >
      <h2 className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--text-2)]">
        {STAGE_LABELS[stage]} <span className="tabular-nums">{cards.length}</span>
      </h2>
      <ul className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {cards.map((c) => <DraggableCard key={c.id} c={c} onPick={(to) => onPick(c.id, to)} />)}
      </ul>
    </section>
  )
}

export default function PipelineClient({
  initialContacts,
  prefixes,
  currentUserId,
}: {
  initialContacts: Card[]
  prefixes: string[]
  currentUserId: string
}) {
  const [contacts, setContacts] = useState(initialContacts)
  const [tag, setTag] = useState('')
  const [owner, setOwner] = useState<'all' | 'mine' | 'unowned'>('all')
  const [subTrade, setSubTrade] = useState('')
  const [pendingMove, setPendingMove] = useState<{ id: string; to: PipelineStage } | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  // Touch (iPad): press and hold to drag, so a normal swipe still scrolls the
  // board and the columns. Mouse: drag after a 6px move.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const subTrades = useMemo(() => Array.from(new Set(contacts.map((c) => c.sub_trade).filter(Boolean) as string[])).sort(), [contacts])

  const visible = contacts.filter((c) => {
    if (tag && !c.tags.some((t) => t.toLowerCase().startsWith(tag.toLowerCase()))) return false
    if (owner === 'mine' && c.owner_user_id !== currentUserId) return false
    if (owner === 'unowned' && c.owner_user_id) return false
    if (subTrade && c.sub_trade !== subTrade) return false
    return true
  })

  function move(id: string, to: PipelineStage, why?: string) {
    const before = contacts
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, pipeline_stage: to } : c)))
    setError(null)
    startTransition(async () => {
      const res = await setStage(id, to, why)
      if (!res.ok) {
        setContacts(before)
        setError(res.error)
      } else if (to === 'lost' || to === 'disqualified') {
        setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...(to === 'lost' ? { lost_reason: why ?? null } : { disqualified_reason: why ?? null }) } : c)))
      }
    })
  }

  function requestMove(id: string, to: PipelineStage) {
    const card = contacts.find((c) => c.id === id)
    if (!card || card.pipeline_stage === to) return
    if (to === 'lost' || to === 'disqualified') {
      setPendingMove({ id, to })
      setReason('')
      return
    }
    move(id, to)
  }

  function onDragEnd(e: DragEndEvent) {
    const to = e.over?.id as PipelineStage | undefined
    if (to) requestMove(String(e.active.id), to)
  }

  const select = 'filter-select'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-[color:var(--text-3)]">
          List
          <select className={`${select} mt-1 block`} value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">All lists</option>
            {prefixes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="text-xs text-[color:var(--text-3)]">
          Owner
          <select className={`${select} mt-1 block`} value={owner} onChange={(e) => setOwner(e.target.value as typeof owner)}>
            <option value="all">Everyone</option>
            <option value="mine">Mine</option>
            <option value="unowned">Unclaimed</option>
          </select>
        </label>
        <label className="text-xs text-[color:var(--text-3)]">
          Sub-trade
          <select className={`${select} mt-1 block`} value={subTrade} onChange={(e) => setSubTrade(e.target.value)}>
            <option value="">All</option>
            {subTrades.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <span className="text-xs text-[color:var(--text-3)]">{visible.length} shown. Drag a card (press and hold on iPad) or use Move to.</span>
      </div>
      {error ? <p role="alert" className="text-sm text-[color:var(--red)]">{error}</p> : null}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => (
            <Column key={stage} stage={stage} cards={visible.filter((c) => c.pipeline_stage === stage)} onPick={requestMove} />
          ))}
        </div>
      </DndContext>

      {pendingMove ? (
        <div role="dialog" aria-modal="true" aria-labelledby="reason-title" className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="panel w-full max-w-md p-5">
            <h2 id="reason-title" className="text-base font-semibold">
              Why {pendingMove.to === 'lost' ? 'lost' : 'disqualified'}?
            </h2>
            <p className="mt-1 text-sm text-[color:var(--text-2)]">
              {pendingMove.to === 'lost' ? 'A reason is required. They come back for a recontact in 180 days.' : 'A reason is required.'}
            </p>
            <input
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-3 w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPendingMove(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!reason.trim()}
                onClick={() => {
                  move(pendingMove.id, pendingMove.to, reason.trim())
                  setPendingMove(null)
                }}
              >
                Move
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
