import { formatTaskDate } from '@/lib/os'
import type { TaskWithWorkstream } from '@/lib/types'
import PriorityBadge from './PriorityBadge'
import WorkstreamBadge from './WorkstreamBadge'

interface TaskCardProps {
  task: TaskWithWorkstream
  onClick?: () => void
  showWorkstream?: boolean
}

export default function TaskCard({
  task,
  onClick,
  showWorkstream = false,
}: TaskCardProps) {
  const content = (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4 text-left shadow-sm transition hover:border-slate-700 hover:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{task.title}</h3>
          <p className="mt-1 text-xs text-slate-400">{formatTaskDate(task.due_date)}</p>
        </div>
        <PriorityBadge priority={task.priority} />
      </div>

      {task.description ? (
        <p className="mt-3 line-clamp-2 text-sm text-slate-300">{task.description}</p>
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
            className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] text-slate-300"
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
    <button type="button" onClick={onClick} className="w-full text-left">
      {content}
    </button>
  )
}
