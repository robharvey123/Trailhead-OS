import type { DealStage } from '@/lib/types'

const STAGE_CLASSES: Record<DealStage, string> = {
  New: 'border-[color:var(--border)] bg-[var(--grey-dim)] text-[color:var(--grey-strong)]',
  Qualified: 'border-[color:var(--accent)]/30 bg-[var(--accent-dim)] text-[color:var(--accent-strong)]',
  'Proposal Sent': 'border-[color:var(--amber)]/30 bg-[var(--amber-dim)] text-[color:var(--amber-strong)]',
  Negotiation: 'border-[color:var(--amber)]/30 bg-[var(--amber-dim)] text-[color:var(--amber-strong)]',
  Won: 'border-[color:var(--emerald)]/30 bg-[var(--emerald-dim)] text-[color:var(--emerald-strong)]',
  Lost: 'border-[color:var(--red)]/30 bg-[var(--red-dim)] text-[color:var(--red-strong)]',
  'On Hold': 'border-[color:var(--border)] bg-[var(--grey-dim)] text-[color:var(--grey-strong)]',
}

export default function StageBadge({ stage }: { stage: DealStage }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold ${STAGE_CLASSES[stage]}`}
    >
      {stage}
    </span>
  )
}
