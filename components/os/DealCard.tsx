'use client'

import type { DealWithRelations } from '@/lib/types'
import { formatCurrency } from '@/lib/format'

interface DealCardProps {
  deal: DealWithRelations
  onClick?: () => void
}

function formatDate(value: string | null) {
  if (!value) return null
  const d = new Date(value)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function DealCard({ deal, onClick }: DealCardProps) {
  const close = formatDate(deal.expected_close_date)

  return (
    <button
      type="button"
      onClick={onClick}
      className="os-card w-full rounded-2xl p-4 text-left transition hover:border-[color:var(--border-light)] hover:bg-[var(--surface-2)]"
    >
      <p className="text-sm font-semibold text-[color:var(--text)]">{deal.name}</p>
      {deal.account?.name ? (
        <p className="mt-0.5 truncate text-xs text-[color:var(--text-2)]">{deal.account.name}</p>
      ) : null}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-[color:var(--text)]">
          {deal.value_amount != null
            ? formatCurrency(deal.value_amount, deal.value_currency || 'GBP')
            : '—'}
        </span>
        <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-[color:var(--text-2)]">
          {deal.probability}%
        </span>
      </div>

      {close ? (
        <p className="mt-2 text-[11px] text-[color:var(--text-3)]">Close: {close}</p>
      ) : null}
    </button>
  )
}
