const WORKSTREAM_SLUG_COLOURS: Record<string, string> = {
  'brand-sales': 'teal',
  ecommerce: 'amber',
  'app-dev': 'purple',
  'mvp-cricket': 'green',
  consulting: 'coral',
  personal: 'blue',
}

const WORKSTREAM_COLOUR_TOKENS: Record<
  string,
  { dot: string; badge: string; card: string }
> = {
  teal: {
    dot: 'bg-teal-400',
    badge: 'border-teal-500/30 bg-teal-500/10 text-teal-200',
    card: 'border-teal-500/20 bg-gradient-to-br from-teal-500/10 via-slate-900 to-slate-950',
  },
  amber: {
    dot: 'bg-amber-400',
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    card: 'border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950',
  },
  purple: {
    dot: 'bg-fuchsia-400',
    badge: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200',
    card: 'border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/10 via-slate-900 to-slate-950',
  },
  green: {
    dot: 'bg-emerald-400',
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    card: 'border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950',
  },
  coral: {
    dot: 'bg-rose-400',
    badge: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    card: 'border-rose-500/20 bg-gradient-to-br from-rose-500/10 via-slate-900 to-slate-950',
  },
  blue: {
    dot: 'bg-sky-400',
    badge: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    card: 'border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-slate-900 to-slate-950',
  },
  slate: {
    dot: 'bg-slate-400',
    badge: 'border-slate-600/50 bg-slate-800/80 text-slate-200',
    card: 'border-slate-700 bg-slate-900/80',
  },
}

const WORKSTREAM_ACCENT_HEX: Record<string, string> = {
  teal: '#1D9E75',
  amber: '#BA7517',
  purple: '#534AB7',
  green: '#639922',
  coral: '#D85A30',
  blue: '#2563EB',
  slate: '#888780',
}

const PRIORITY_TOKENS: Record<string, string> = {
  low: 'border-slate-600/60 bg-slate-800/80 text-slate-200',
  medium: 'border-amber-300/40 bg-amber-300/10 text-amber-100',
  high: 'border-orange-400/40 bg-orange-400/10 text-orange-100',
  urgent: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
  critical: 'border-red-500/40 bg-red-500/10 text-red-100',
}

const TASK_STATUS_TOKENS: Record<string, string> = {
  todo: 'border-slate-500/40 bg-slate-500/10 text-slate-200',
  in_progress: 'border-blue-500/40 bg-blue-500/10 text-blue-100',
  blocked: 'border-red-400/40 bg-red-400/10 text-red-100',
  done: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  cancelled: 'border-slate-300/30 bg-slate-300/10 text-slate-300 line-through',
}

export function resolveWorkstreamColour(value?: string | null) {
  if (!value) {
    return 'slate'
  }

  return WORKSTREAM_SLUG_COLOURS[value] ?? value
}

export function getWorkstreamColourClasses(value?: string | null) {
  const colour = resolveWorkstreamColour(value)
  return WORKSTREAM_COLOUR_TOKENS[colour] ?? WORKSTREAM_COLOUR_TOKENS.slate
}

export function getWorkstreamAccentHex(value?: string | null) {
  const colour = resolveWorkstreamColour(value)
  return WORKSTREAM_ACCENT_HEX[colour] ?? WORKSTREAM_ACCENT_HEX.slate
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
