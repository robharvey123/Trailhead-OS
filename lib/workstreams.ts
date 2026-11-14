/**
 * Workstream colours.
 *
 * These are data, not brand: they tell five workstreams apart on boards, badges
 * and charts. This map is the only place their hex values are written. Every
 * badge, dot, card and chart series reads from here, on the web and in PDFs.
 *
 * Each workstream has three values chosen for the OS's light ground:
 * - `hex`: the solid colour, for dots, bars, chart series and card rules.
 * - `ink`: a darker step for type, at least 4.5:1 on `dim` and on white.
 * - `dim`: a pale ground for badges.
 *
 * The class strings are written out in full so Tailwind can see them.
 */
export type WorkstreamKey =
  | 'brand-sales'
  | 'ecommerce'
  | 'app-dev'
  | 'mvp-cricket'
  | 'consulting'
  | 'personal'
  | 'default'

export interface WorkstreamColour {
  /** The name used in the database's `workstreams.colour` column. */
  name: string
  hex: string
  ink: string
  dim: string
  /** A small filled dot. */
  dot: string
  /** A pill: tinted ground, darker type, soft border. */
  badge: string
  /** A white card with the workstream colour as its top rule. */
  card: string
  /** Type in the workstream colour. */
  header: string
}

export const WORKSTREAM_COLOURS: Record<WorkstreamKey, WorkstreamColour> = {
  'brand-sales': {
    name: 'teal',
    hex: '#0D9488',
    ink: '#0F766E',
    dim: '#CCFBF1',
    dot: 'bg-[#0D9488]',
    badge: 'border-[#0D9488]/30 bg-[#CCFBF1] text-[#0F766E]',
    card: 'border-[var(--border)] border-t-[#0D9488] bg-[var(--bg)]',
    header: 'text-[#0F766E]',
  },
  ecommerce: {
    name: 'amber',
    hex: '#D97706',
    ink: '#B45309',
    dim: '#FEF3C7',
    dot: 'bg-[#D97706]',
    badge: 'border-[#D97706]/30 bg-[#FEF3C7] text-[#B45309]',
    card: 'border-[var(--border)] border-t-[#D97706] bg-[var(--bg)]',
    header: 'text-[#B45309]',
  },
  'app-dev': {
    name: 'purple',
    hex: '#7C3AED',
    ink: '#6D28D9',
    dim: '#EDE9FE',
    dot: 'bg-[#7C3AED]',
    badge: 'border-[#7C3AED]/30 bg-[#EDE9FE] text-[#6D28D9]',
    card: 'border-[var(--border)] border-t-[#7C3AED] bg-[var(--bg)]',
    header: 'text-[#6D28D9]',
  },
  'mvp-cricket': {
    name: 'green',
    hex: '#16A34A',
    ink: '#15803D',
    dim: '#DCFCE7',
    dot: 'bg-[#16A34A]',
    badge: 'border-[#16A34A]/30 bg-[#DCFCE7] text-[#15803D]',
    card: 'border-[var(--border)] border-t-[#16A34A] bg-[var(--bg)]',
    header: 'text-[#15803D]',
  },
  consulting: {
    name: 'coral',
    hex: '#E11D48',
    ink: '#BE123C',
    dim: '#FFE4E6',
    dot: 'bg-[#E11D48]',
    badge: 'border-[#E11D48]/30 bg-[#FFE4E6] text-[#BE123C]',
    card: 'border-[var(--border)] border-t-[#E11D48] bg-[var(--bg)]',
    header: 'text-[#BE123C]',
  },
  personal: {
    name: 'blue',
    hex: '#64748B',
    ink: '#475569',
    dim: '#F1F5F9',
    dot: 'bg-[#64748B]',
    badge: 'border-[#64748B]/30 bg-[#F1F5F9] text-[#475569]',
    card: 'border-[var(--border)] border-t-[#64748B] bg-[var(--bg)]',
    header: 'text-[#475569]',
  },
  default: {
    name: 'grey',
    hex: '#64748B',
    ink: '#475569',
    dim: '#F1F5F9',
    dot: 'bg-[#64748B]',
    badge: 'border-[#64748B]/30 bg-[#F1F5F9] text-[#475569]',
    card: 'border-[var(--border)] bg-[var(--bg)]',
    header: 'text-[#475569]',
  },
}

/** Legacy colour names (`workstreams.colour`) to workstream keys. */
const COLOUR_NAME_TO_KEY: Record<string, WorkstreamKey> = {
  teal: 'brand-sales',
  amber: 'ecommerce',
  purple: 'app-dev',
  green: 'mvp-cricket',
  coral: 'consulting',
  blue: 'personal',
}

/** Resolve a workstream slug or a legacy colour name to a key in the map. */
export function resolveWorkstreamKey(value?: string | null): WorkstreamKey {
  if (!value) return 'default'
  if (value in WORKSTREAM_COLOURS) return value as WorkstreamKey
  return COLOUR_NAME_TO_KEY[value] ?? 'default'
}

/** The colour entry for a workstream slug or a legacy colour name. */
export function getWorkstreamColour(value?: string | null): WorkstreamColour {
  return WORKSTREAM_COLOURS[resolveWorkstreamKey(value)]
}
