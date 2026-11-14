'use client'

import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ENGAGEMENT_TASK_PRIORITY_LABELS, type EngagementTaskPriority, type EngagementTaskWithRelations } from '@/lib/types'
import { labelColor } from '@/lib/tags'

const PRIORITY_DOT: Record<EngagementTaskPriority, string> = {
  urgent: 'bg-[var(--red)]', high: 'bg-[var(--amber)]', normal: 'bg-[var(--text-3)]', low: 'bg-[var(--text-3)]',
}

function initials(name?: string | null) {
  if (!name) return '—'
  return name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()
}
function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : null
}
/** Compact logged-time label: 45 → "45m", 90 → "1h 30m", 120 → "2h". */
function fmtLogged(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/**
 * Memoised: a busy engagement board renders 50-150 of these, and `Board`
 * re-renders for things that have nothing to do with any individual card — the
 * two aria-live announcement strings after a drop, the error string, and every
 * sort/label/due filter change (which rebuilds the column lists but leaves most
 * `task` object identities untouched).
 *
 * The props are all stable by construction: `task` comes straight out of Board's
 * `tasks` state and only gets a new identity when that card actually changes,
 * `loggedMinutes` is a number, and `onOpen`/`onToggleLabel` are `useCallback`s
 * (Board / EngagementTasksClient). `activeLabels` is a `useState` array.
 *
 * Caveat, stated honestly: this does NOT stop re-renders during an active drag.
 * `useSortable` subscribes each card to the dnd-kit store, so they re-render from
 * the inside regardless of props. The win is on everything else.
 */
function TaskCard({
  task,
  loggedMinutes = 0,
  onOpen,
  activeLabels,
  onToggleLabel,
}: {
  task: EngagementTaskWithRelations
  /** Total time logged against this ticket, across all users. 0 = no chip shown. */
  loggedMinutes?: number
  onOpen: (id: string) => void
  activeLabels?: string[]
  onToggleLabel?: (label: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  const due = fmtDate(task.due_date)
  return (
    <div
      ref={setNodeRef}
      className="mb-2 cursor-grab rounded-control border border-[var(--border)] bg-[var(--bg)] p-2.5"
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task.id)}
    >
      <div className="flex justify-between gap-2">
        {/* The card itself is the drag handle (dnd-kit's attributes make it a
            keyboard drag target), so opening the ticket needs its own control. */}
        <button
          type="button"
          className="td-name cursor-pointer border-0 bg-transparent p-0 text-left text-[13px]"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onOpen(task.id) }}
        >
          {task.title}
        </button>
        <span title={ENGAGEMENT_TASK_PRIORITY_LABELS[task.priority]} className={`mt-1 h-2 w-2 shrink-0 rounded-pill ${PRIORITY_DOT[task.priority]}`} />
      </div>
      {task.labels.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {task.labels.map((l) => {
            const c = labelColor(l)
            const active = activeLabels?.includes(l) ?? false
            return (
              <button
                key={l}
                type="button"
                // Stop the dnd-kit sensor + card click so tapping a tag filters, not drags/opens.
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggleLabel?.(l) }}
                title={active ? `Remove filter: ${l}` : `Filter by “${l}”`}
                className={`max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap rounded-pill border px-2 py-0.5 text-[10px] font-semibold leading-[1.4] ${onToggleLabel ? 'cursor-pointer' : 'cursor-default'}`}
                // The hue is derived from the label text, so it stays inline. An
                // active filter chip keeps the label's ink on a deeper tint with
                // an ink border: white type on the solid hue fails contrast for
                // the lighter hues.
                style={{
                  background: active ? `hsl(${c.hue} 70% 50% / 0.3)` : c.bg,
                  color: c.fg,
                  borderColor: active ? c.fg : c.border,
                }}
              >
                {l}
              </button>
            )
          })}
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-2">
          <span className={`text-[11px] ${due ? 'text-[var(--text-2)]' : 'text-[var(--text-3)]'}`}>{due ?? '—'}</span>
          {loggedMinutes > 0 ? (
            <span title={`${fmtLogged(loggedMinutes)} logged`} className="inline-flex items-center gap-[3px] text-[10px] text-[var(--text-3)]">
              ⏱ {fmtLogged(loggedMinutes)}
            </span>
          ) : null}
        </span>
        <span title={task.assignee?.full_name ?? 'Unassigned'} className="flex h-[22px] w-[22px] items-center justify-center rounded-pill bg-[var(--surface-3)] text-[10px] text-[var(--text-2)]">
          {initials(task.assignee?.full_name)}
        </span>
      </div>
    </div>
  )
}

export default memo(TaskCard)
