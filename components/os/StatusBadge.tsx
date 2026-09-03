import type {
  AccountStatus,
  ContactStatus,
  EnquiryStatus,
  InvoiceStatus,
  ProjectStatus,
  QuoteStatus,
} from '@/lib/types'

type StatusKind = 'account' | 'contact' | 'enquiry' | 'invoice' | 'project' | 'quote'

const STATUS_CLASSES: Record<StatusKind, Record<string, string>> = {
  account: {
    prospect: 'border-[color:var(--accent)]/30 bg-[var(--accent-dim)] text-[color:var(--accent-strong)]',
    contacted: 'border-[color:var(--amber)]/30 bg-[var(--amber-dim)] text-[color:var(--amber-strong)]',
    active: 'border-[color:var(--emerald)]/30 bg-[var(--emerald-dim)] text-[color:var(--emerald-strong)]',
    listed: 'border-[color:var(--green)]/30 bg-[var(--green-dim)] text-[color:var(--green-strong)]',
    declined: 'border-[color:var(--red)]/30 bg-[var(--red-dim)] text-[color:var(--red-strong)]',
    on_hold: 'border-[color:var(--border)] bg-[var(--surface-2)] text-[color:var(--text-2)]',
    inactive: 'border-[color:var(--border)] bg-[var(--surface-2)] text-[color:var(--text-2)]',
    archived: 'border-[color:var(--red)]/30 bg-[var(--red-dim)] text-[color:var(--red-strong)]',
  },
  contact: {
    lead: 'border-[color:var(--accent)]/30 bg-[var(--accent-dim)] text-[color:var(--accent-strong)]',
    active: 'border-[color:var(--emerald)]/30 bg-[var(--emerald-dim)] text-[color:var(--emerald-strong)]',
    inactive: 'border-[color:var(--border)] bg-[var(--surface-2)] text-[color:var(--text-2)]',
    archived: 'border-[color:var(--red)]/30 bg-[var(--red-dim)] text-[color:var(--red-strong)]',
  },
  enquiry: {
    new: 'border-[color:var(--amber)]/30 bg-[var(--amber-dim)] text-[color:var(--amber-strong)]',
    received: 'border-[color:var(--amber)]/30 bg-[var(--amber-dim)] text-[color:var(--amber-strong)]',
    reviewed: 'border-[color:var(--accent)]/30 bg-[var(--accent-dim)] text-[color:var(--accent-strong)]',
    under_review: 'border-[color:var(--accent)]/30 bg-[var(--accent-dim)] text-[color:var(--accent-strong)]',
    quoted: 'border-[color:var(--accent)]/30 bg-[var(--accent-dim)] text-[color:var(--accent-strong)]',
    closed: 'border-[color:var(--border)] bg-[var(--surface-2)] text-[color:var(--text-2)]',
    converted: 'border-[color:var(--emerald)]/30 bg-[var(--emerald-dim)] text-[color:var(--emerald-strong)]',
  },
  invoice: {
    draft: 'border-[color:var(--border)] bg-[var(--surface-2)] text-[color:var(--text-2)]',
    sent: 'border-[color:var(--accent)]/30 bg-[var(--accent-dim)] text-[color:var(--accent-strong)]',
    part_paid: 'border-[color:var(--amber)]/30 bg-[var(--amber-dim)] text-[color:var(--amber-strong)]',
    paid: 'border-[color:var(--emerald)]/30 bg-[var(--emerald-dim)] text-[color:var(--emerald-strong)]',
    overdue: 'border-[color:var(--red)]/30 bg-[var(--red-dim)] text-[color:var(--red-strong)]',
    cancelled: 'border-[color:var(--amber)]/30 bg-[var(--amber-dim)] text-[color:var(--amber-strong)]',
  },
  project: {
    planning: 'border-[color:var(--accent)]/30 bg-[var(--accent-dim)] text-[color:var(--accent-strong)]',
    active: 'border-[color:var(--emerald)]/30 bg-[var(--emerald-dim)] text-[color:var(--emerald-strong)]',
    on_hold: 'border-[color:var(--amber)]/30 bg-[var(--amber-dim)] text-[color:var(--amber-strong)]',
    completed: 'border-[color:var(--accent)]/30 bg-[var(--accent-dim)] text-[color:var(--accent-strong)]',
    cancelled: 'border-[color:var(--border)] bg-[var(--surface-2)] text-[color:var(--text-3)]',
  },
  quote: {
    draft: 'border-[color:var(--border)] bg-[var(--surface-2)] text-[color:var(--text-2)]',
    review: 'border-[color:var(--amber)]/30 bg-[var(--amber-dim)] text-[color:var(--amber-strong)]',
    sent: 'border-[color:var(--accent)]/30 bg-[var(--accent-dim)] text-[color:var(--accent-strong)]',
    accepted: 'border-[color:var(--emerald)]/30 bg-[var(--emerald-dim)] text-[color:var(--emerald-strong)]',
    rejected: 'border-[color:var(--red)]/30 bg-[var(--red-dim)] text-[color:var(--red-strong)]',
    declined: 'border-[color:var(--red)]/30 bg-[var(--red-dim)] text-[color:var(--red-strong)]',
    expired: 'border-[color:var(--amber)]/30 bg-[var(--amber-dim)] text-[color:var(--amber-strong)]',
    converted: 'border-[color:var(--accent)]/30 bg-[var(--accent-dim)] text-[color:var(--accent-strong)]',
  },
}

function formatStatusLabel(
  value: AccountStatus | ContactStatus | EnquiryStatus | InvoiceStatus | ProjectStatus | QuoteStatus | string
) {
  return value
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function StatusBadge({
  status,
  kind,
  className = '',
}: {
  status: AccountStatus | ContactStatus | EnquiryStatus | InvoiceStatus | ProjectStatus | QuoteStatus | string
  kind: StatusKind
  className?: string
}) {
  const classes =
    STATUS_CLASSES[kind][status] ??
    'border-[color:var(--border)] bg-[var(--surface-2)] text-[color:var(--text-2)]'

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${classes} ${className}`.trim()}
    >
      {formatStatusLabel(status)}
    </span>
  )
}
