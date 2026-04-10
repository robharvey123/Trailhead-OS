const WORKSTREAM_SLUG_COLOURS: Record<string, string> = {
  'brand-sales': 'brand-sales',
  ecommerce: 'ecommerce',
  'app-dev': 'app-dev',
  'mvp-cricket': 'mvp-cricket',
  consulting: 'consulting',
  personal: 'personal',
}

/* Reverse map: legacy colour name → slug (for components that pass workstream.colour) */
const WORKSTREAM_COLOUR_TO_SLUG: Record<string, string> = {
  teal: 'brand-sales',
  amber: 'ecommerce',
  purple: 'app-dev',
  green: 'mvp-cricket',
  coral: 'consulting',
  blue: 'personal',
}

const WORKSTREAM_COLOUR_TOKENS: Record<
  string,
  { dot: string; badge: string; card: string; header: string; hex: string }
> = {
  'brand-sales': {
    dot: 'bg-purple-400',
    badge: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
    card: 'border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-[#1A1A28] to-[#0C0C14]',
    header: 'text-purple-400',
    hex: '#A78BFA',
  },
  ecommerce: {
    dot: 'bg-orange-400',
    badge: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    card: 'border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-[#1A1A28] to-[#0C0C14]',
    header: 'text-orange-400',
    hex: '#FF6B35',
  },
  'app-dev': {
    dot: 'bg-blue-400',
    badge: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    card: 'border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-[#1A1A28] to-[#0C0C14]',
    header: 'text-blue-400',
    hex: '#4B9FFF',
  },
  'mvp-cricket': {
    dot: 'bg-emerald-400',
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    card: 'border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-[#1A1A28] to-[#0C0C14]',
    header: 'text-emerald-400',
    hex: '#34D399',
  },
  consulting: {
    dot: 'bg-pink-400',
    badge: 'border-pink-500/30 bg-pink-500/10 text-pink-300',
    card: 'border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-[#1A1A28] to-[#0C0C14]',
    header: 'text-pink-400',
    hex: '#FF4081',
  },
  personal: {
    dot: 'bg-[#B8FF00]',
    badge: 'border-[#B8FF00]/30 bg-[#B8FF00]/10 text-[#B8FF00]',
    card: 'border-[#B8FF00]/20 bg-gradient-to-br from-[#B8FF00]/10 via-[#1A1A28] to-[#0C0C14]',
    header: 'text-[#B8FF00]',
    hex: '#B8FF00',
  },
  default: {
    dot: 'bg-slate-400',
    badge: 'border-slate-600/50 bg-slate-800/80 text-slate-300',
    card: 'border-[#2A2A3A] bg-[#1A1A28]',
    header: 'text-slate-400',
    hex: '#9CA3AF',
  },
}

const PRIORITY_TOKENS: Record<string, string> = {
  low: 'border-slate-600/50 bg-slate-800/60 text-slate-400',
  medium: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  high: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  urgent: 'border-orange-400/50 bg-orange-400/15 text-orange-200',
  critical: 'border-[#FF6B35]/60 bg-[#FF6B35]/20 text-[#FF6B35] font-bold',
}

const TASK_STATUS_TOKENS: Record<string, string> = {
  todo: 'border-slate-600/50 bg-slate-800/60 text-slate-400',
  in_progress: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  blocked: 'border-[#FF4081]/40 bg-[#FF4081]/10 text-[#FF4081]',
  done: 'border-[#34D399]/30 bg-[#34D399]/10 text-[#34D399]',
  cancelled: 'border-slate-600/30 bg-slate-800/40 text-slate-500 line-through',
}

export function resolveWorkstreamColour(value?: string | null) {
  if (!value) {
    return 'default'
  }

  // Direct slug match
  if (value in WORKSTREAM_COLOUR_TOKENS) {
    return value
  }

  // Legacy slug → slug lookup
  if (value in WORKSTREAM_SLUG_COLOURS) {
    return WORKSTREAM_SLUG_COLOURS[value]
  }

  // Legacy colour name → slug lookup
  if (value in WORKSTREAM_COLOUR_TO_SLUG) {
    return WORKSTREAM_COLOUR_TO_SLUG[value]
  }

  return 'default'
}

export function getWorkstreamColourClasses(value?: string | null) {
  const slug = resolveWorkstreamColour(value)
  return WORKSTREAM_COLOUR_TOKENS[slug] ?? WORKSTREAM_COLOUR_TOKENS.default
}

export function getWorkstreamAccentHex(value?: string | null) {
  const classes = getWorkstreamColourClasses(value)
  return classes.hex
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
