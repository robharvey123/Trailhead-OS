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
    prospect: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    inactive: 'border-slate-600/60 bg-slate-800/80 text-slate-200',
    archived: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  },
  contact: {
    lead: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    inactive: 'border-slate-600/60 bg-slate-800/80 text-slate-200',
    archived: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  },
  enquiry: {
    new: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    received: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    reviewed: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    under_review: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    quoted: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
    closed: 'border-slate-600/60 bg-slate-800/80 text-slate-200',
    converted: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  },
  invoice: {
    draft: 'border-slate-600/60 bg-slate-800/80 text-slate-200',
    sent: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    paid: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    overdue: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    cancelled: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  },
  project: {
    planning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    on_hold: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    completed: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
    cancelled: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  },
  quote: {
    draft: 'border-slate-600/60 bg-slate-800/80 text-slate-200',
    review: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    sent: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    accepted: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    rejected: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    declined: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    expired: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    converted: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
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
    'border-slate-600/60 bg-slate-800/80 text-slate-200'

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${classes} ${className}`.trim()}
    >
      {formatStatusLabel(status)}
    </span>
  )
}
