import { getWorkstreamColour, resolveWorkstreamKey } from '@/lib/workstreams'

// Priority and task status are status colours: data, not brand. They read the
// status token pairs from the OS theme (app/globals.css).
const PRIORITY_TOKENS: Record<string, string> = {
  low: 'border-[var(--border)] bg-[var(--grey-dim)] text-[var(--grey-strong)]',
  medium: 'border-[var(--amber)]/30 bg-[var(--amber-dim)] text-[var(--amber-strong)]',
  high: 'border-[var(--red)]/30 bg-[var(--red-dim)] text-[var(--red-strong)]',
  urgent: 'border-[var(--red)]/60 bg-[var(--red-dim)] text-[var(--red-strong)] font-semibold',
  critical: 'border-[var(--red)] bg-[var(--red)] text-white font-bold',
}

const TASK_STATUS_TOKENS: Record<string, string> = {
  todo: 'border-[var(--border)] bg-[var(--grey-dim)] text-[var(--grey-strong)]',
  in_progress: 'border-[var(--accent)]/30 bg-[var(--accent-dim)] text-[var(--accent-strong)]',
  blocked: 'border-[var(--red)]/40 bg-[var(--red-dim)] text-[var(--red-strong)]',
  done: 'border-[var(--green)]/30 bg-[var(--green-dim)] text-[var(--green-strong)]',
  cancelled: 'border-[var(--border)] bg-[var(--grey-dim)] text-[var(--grey-strong)] line-through',
}

/** Workstream colours live in lib/workstreams.ts. These wrappers keep the older call sites working. */
export function resolveWorkstreamColour(value?: string | null) {
  return resolveWorkstreamKey(value)
}

export function getWorkstreamColourClasses(value?: string | null) {
  return getWorkstreamColour(value)
}

export function getWorkstreamAccentHex(value?: string | null) {
  return getWorkstreamColour(value).hex
}

export function getPriorityClasses(priority?: string | null) {
  if (!priority) {
    return PRIORITY_TOKENS.medium
  }

  return PRIORITY_TOKENS[priority] ?? PRIORITY_TOKENS.medium
}

export function getTaskStatusClasses(status?: string | null) {
  if (!status) {
    return TASK_STATUS_TOKENS.todo
  }

  return TASK_STATUS_TOKENS[status] ?? TASK_STATUS_TOKENS.todo
}

export function formatTaskDate(value?: string | null) {
  if (!value) {
    return 'No due date'
  }

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

export function formatTaskTime(value?: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(`1970-01-01T${value}`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-GB', {
    timeStyle: 'short',
  }).format(date)
}

export function formatTaskSchedule(date?: string | null, time?: string | null) {
  if (!date) {
    return 'No due date'
  }

  const formattedDate = formatTaskDate(date)
  const formattedTime = formatTaskTime(time)

  if (!formattedTime) {
    return formattedDate
  }

  return `${formattedDate} at ${formattedTime}`
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Unknown'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
