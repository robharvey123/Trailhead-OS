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
    inactive: 'border-[#2A2A3A]/60 bg-[#2A2A3A]/80 text-[#9CA3AF]',
    archived: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  },
  contact: {
    lead: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    inactive: 'border-[#2A2A3A]/60 bg-[#2A2A3A]/80 text-[#9CA3AF]',
    archived: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  },
  enquiry: {
    new: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    received: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    reviewed: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    under_review: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    quoted: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
    closed: 'border-[#2A2A3A]/60 bg-[#2A2A3A]/80 text-[#9CA3AF]',
    converted: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  },
  invoice: {
    draft: 'border-[#2A2A3A]/60 bg-[#2A2A3A]/80 text-[#9CA3AF]',
    sent: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    paid: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    overdue: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    cancelled: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  },
  project: {
    planning: 'border-[#B8FF00]/30 bg-[#B8FF00]/10 text-[#B8FF00]',
    active: 'border-[#34D399]/30 bg-[#34D399]/15 text-[#34D399]',
    on_hold: 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300',
    completed: 'border-[#A78BFA]/30 bg-[#A78BFA]/10 text-[#A78BFA]',
    cancelled: 'border-[#2A2A3A]/30 bg-[#2A2A3A]/40 text-white0',
  },
  quote: {
    draft: 'border-[#2A2A3A]/60 bg-[#2A2A3A]/80 text-[#9CA3AF]',
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
    'border-[#2A2A3A]/60 bg-[#2A2A3A]/80 text-[#9CA3AF]'

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${classes} ${className}`.trim()}
    >
      {formatStatusLabel(status)}
    </span>
  )
}
