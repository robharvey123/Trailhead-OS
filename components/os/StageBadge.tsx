import type { DealStage } from '@/lib/types'

const STAGE_CLASSES: Record<DealStage, string> = {
  New: 'border-[#3A3A4A] bg-[#23232F] text-[#9CA3AF]',
  Qualified: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  'Proposal Sent': 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  Negotiation: 'border-orange-500/50 bg-orange-500/15 text-orange-300',
  Won: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  Lost: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  'On Hold': 'border-[#3A3A4A] bg-[#15151F] text-[#6B7280]',
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
