import type { ButtonHTMLAttributes } from 'react'
import { formatTaskSchedule } from '@/lib/os'
import type { TaskWithWorkstream } from '@/lib/types'
import PriorityBadge from './PriorityBadge'
import WorkstreamBadge from './WorkstreamBadge'

interface TaskCardProps {
  task: TaskWithWorkstream
  onClick?: () => void
  showWorkstream?: boolean
  buttonProps?: ButtonHTMLAttributes<HTMLButtonElement>
}

export default function TaskCard({
  task,
  onClick,
  showWorkstream = false,
  buttonProps,
}: TaskCardProps) {
  const content = (
    <div className="os-card p-4 text-left transition hover:border-[color:var(--border-light)] hover:bg-[var(--surface-2)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--text)]">{task.title}</h3>
          <p className="mt-1 text-xs text-[color:var(--text-2)]">
            {formatTaskSchedule(task.due_date, task.due_time)}
          </p>
        </div>
        <PriorityBadge priority={task.priority} />
      </div>

      {task.description ? (
        <p className="mt-3 line-clamp-2 text-sm text-[color:var(--text-2)]">{task.description}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {showWorkstream && task.workstream_label ? (
          <WorkstreamBadge
            label={task.workstream_label}
            slug={task.workstream_slug}
            colour={task.workstream_colour}
          />
        ) : null}
        {task.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-[color:var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] text-[color:var(--text-2)]"
          >
            #{tag}
          </span>
        ))}
      </div>
    </div>
  )

  if (!onClick) {
    return content
  }

  return (
    <button
      type="button"
      onClick={onClick}
      {...buttonProps}
      className={`w-full text-left ${buttonProps?.className ?? ''}`.trim()}
    >
      {content}
    </button>
  )
}
