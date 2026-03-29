'use client'

import { useEffect, useRef, useState } from 'react'
import type { PricingTier } from '@/lib/types'

interface PricingTierSelectorProps {
  value: string | null
  onChange: (tier: PricingTier | null) => void
  onRatesApplied?: (rates: PricingTier) => void
  autoApplyInitialSelection?: boolean
}

function formatCurrency(value: number, suffix = '') {
  return `£${Number(value).toFixed(0)}${suffix}`
}

export default function PricingTierSelector({
  value,
  onChange,
  onRatesApplied,
  autoApplyInitialSelection = false,
}: PricingTierSelectorProps) {
  const [tiers, setTiers] = useState<PricingTier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hasInitialised = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function loadPricingTiers() {
      try {
        const response = await fetch('/api/pricing-tiers', {
          credentials: 'include',
        })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load pricing tiers')
        }

        if (cancelled) {
          return
        }

        setTiers(Array.isArray(data.pricing_tiers) ? data.pricing_tiers : [])
      } catch (loadError) {
        if (cancelled) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Failed to load pricing tiers')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadPricingTiers()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (hasInitialised.current || loading || tiers.length === 0) {
      return
    }

    const selectedTier = tiers.find((tier) => tier.id === value) ?? tiers.find((tier) => tier.is_default) ?? null
    hasInitialised.current = true
    onChange(selectedTier)

    if (selectedTier && autoApplyInitialSelection) {
      onRatesApplied?.(selectedTier)
    }
  }, [autoApplyInitialSelection, loading, onChange, onRatesApplied, tiers, value])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="min-h-[220px] rounded-[1.75rem] border border-slate-800 bg-slate-950/50 p-5 animate-pulse"
              />
            ))
          : tiers.map((tier) => {
              const isSelected = tier.id === value

              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => {
                    onChange(tier)
                    onRatesApplied?.(tier)
                  }}
                  className={`text-left rounded-[1.75rem] border p-5 transition ${
                    isSelected
                      ? 'border-sky-500 bg-sky-500/10 shadow-[0_0_0_1px_rgba(14,165,233,0.25)]'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold text-slate-50">{tier.name}</p>
                      <p className="mt-2 text-sm text-slate-400">{tier.description}</p>
                    </div>
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                        isSelected
                          ? 'border-sky-400 bg-sky-500 text-slate-950'
                          : 'border-slate-700 text-transparent'
                      }`}
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
                        <path d="M7.7 13.3 4.4 10l-1.4 1.4 4.7 4.7L17 6.8l-1.4-1.4z" />
                      </svg>
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Hourly</p>
                      <p className="mt-1 font-medium text-slate-100">{formatCurrency(tier.hourly_rate)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Day</p>
                      <p className="mt-1 font-medium text-slate-100">{formatCurrency(tier.day_rate)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Retainer</p>
                      <p className="mt-1 font-medium text-slate-100">
                        {formatCurrency(tier.monthly_retainer, '/mo')}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Hosting</p>
                      <p className="mt-1 font-medium text-slate-100">
                        {formatCurrency(tier.hosting_maintenance, '/mo')}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-slate-300">Fixed margin: {tier.fixed_fee_margin}%</p>
                </button>
              )
            })}
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <p className="text-sm text-slate-400">
        Selecting a tier pre-fills rates on new quotes - you can still edit individual line
        items after.
      </p>
    </div>
  )
}
