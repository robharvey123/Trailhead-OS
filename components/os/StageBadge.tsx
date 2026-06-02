import type { DealStage } from '@/lib/types'

const STAGE_CLASSES: Record<DealStage, string> = {
  New: 'border-[color:var(--border)] bg-[var(--grey-dim)] text-[color:var(--text-2)]',
  Qualified: 'border-[color:var(--accent)] bg-[var(--accent-dim)] text-[color:var(--accent-strong)]',
  'Proposal Sent': 'border-[color:var(--amber)] bg-[var(--amber-dim)] text-[color:var(--amber-strong)]',
  Negotiation: 'border-[color:var(--amber)] bg-[var(--amber-dim)] text-[color:var(--amber-strong)]',
  Won: 'border-[color:var(--emerald)] bg-[var(--emerald-dim)] text-[color:var(--emerald-strong)]',
  Lost: 'border-[color:var(--red)] bg-[var(--red-dim)] text-[color:var(--red-strong)]',
  'On Hold': 'border-[color:var(--border)] bg-[var(--grey-dim)] text-[color:var(--text-3)]',
}

export default function StageBadge({ stage }: { stage: DealStage }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STAGE_CLASSES[stage]}`}
    >
      {stage}
    </span>
  )
}
