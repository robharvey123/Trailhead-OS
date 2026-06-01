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
      className="w-full rounded-2xl border border-[#2A2A3A] bg-[#13131E] p-4 text-left transition hover:border-[#3A3A4A] hover:bg-[#16161F]"
    >
      <p className="text-sm font-semibold text-white">{deal.name}</p>
      {deal.account?.name ? (
        <p className="mt-0.5 truncate text-xs text-[#9CA3AF]">{deal.account.name}</p>
      ) : null}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">
          {deal.value_amount != null
            ? formatCurrency(deal.value_amount, deal.value_currency || 'GBP')
            : '—'}
        </span>
        <span className="rounded-full border border-[#2A2A3A] bg-[#0C0C14] px-2 py-0.5 text-[11px] text-[#9CA3AF]">
          {deal.probability}%
        </span>
      </div>

      {close ? (
        <p className="mt-2 text-[11px] text-[#6B7280]">Close: {close}</p>
      ) : null}
    </button>
  )
}
