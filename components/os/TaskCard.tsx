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
    <div className="rounded-3xl border border-[#2A2A3A] bg-[#1A1A28] p-4 text-left shadow-sm transition hover:border-[#2A2A3A] hover:bg-[#B8FF00]/[0.025]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{task.title}</h3>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            {formatTaskSchedule(task.due_date, task.due_time)}
          </p>
        </div>
        <PriorityBadge priority={task.priority} />
      </div>

      {task.description ? (
        <p className="mt-3 line-clamp-2 text-sm text-[#9CA3AF]">{task.description}</p>
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
            className="rounded-full border border-[#2A2A3A] bg-[#0C0C14] px-2.5 py-1 text-[11px] text-[#9CA3AF]"
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
