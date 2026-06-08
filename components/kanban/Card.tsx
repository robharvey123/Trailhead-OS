'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ENGAGEMENT_TASK_PRIORITY_LABELS, type EngagementTaskPriority, type EngagementTaskWithRelations } from '@/lib/types'
import { labelColor } from '@/lib/tags'

const PRIORITY_COLOR: Record<EngagementTaskPriority, string> = {
  urgent: 'var(--red)', high: 'var(--amber)', normal: 'var(--text-3)', low: 'var(--text-3)',
}

function initials(name?: string | null) {
  if (!name) return '—'
  return name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()
}
function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : null
}

export default function TaskCard({
  task,
  onOpen,
  activeLabels,
  onToggleLabel,
}: {
  task: EngagementTaskWithRelations
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
      style={{ ...style, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 8, cursor: 'grab' }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task.id)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span className="td-name" style={{ fontSize: 13 }}>{task.title}</span>
        <span title={ENGAGEMENT_TASK_PRIORITY_LABELS[task.priority]} style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLOR[task.priority], flexShrink: 0, marginTop: 4 }} />
      </div>
      {task.labels.length > 0 ? (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
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
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  padding: '2px 8px',
                  borderRadius: 999,
                  cursor: onToggleLabel ? 'pointer' : 'default',
                  maxWidth: 180,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  background: active ? c.solidBg : c.bg,
                  color: active ? '#fff' : c.fg,
                  border: `1px solid ${active ? c.solidBg : c.border}`,
                }}
              >
                {l}
              </button>
            )
          })}
        </div>
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 11, color: due ? 'var(--text-2)' : 'var(--text-3)' }}>{due ?? '—'}</span>
        <span title={task.assignee?.full_name ?? 'Unassigned'} style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--surface-3)', color: 'var(--text-2)', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {initials(task.assignee?.full_name)}
        </span>
      </div>
    </div>
  )
}
