import type { CallEligibility } from '@/lib/outreach/call-eligibility'
import { ELIGIBILITY_LABELS } from '@/lib/sales/data'

const CLASS_BY_REASON: Record<string, string> = {
  eligible: 'status-active',
  unscreened: 'status-contacted',
  ctps_stale: 'status-contacted',
  no_phone: 'status-inactive',
}

export default function EligibilityBadge({ eligibility }: { eligibility: CallEligibility | null }) {
  const reason = eligibility?.reason ?? 'unscreened'
  return (
    <span className={`status-badge ${CLASS_BY_REASON[reason] ?? 'status-declined'}`}>
      {ELIGIBILITY_LABELS[reason]}
    </span>
  )
}
