'use client'

import { useMemo, useState } from 'react'
import type { PricingTier } from '@/lib/types'

type DraftTier = {
  id: string
  name: string
  description: string
  hourly_rate: string
  day_rate: string
  monthly_retainer: string
  hosting_maintenance: string
  fixed_fee_margin: string
  is_default: boolean
}

function toDraft(tier: PricingTier): DraftTier {
  return {
    id: tier.id,
    name: tier.name,
    description: tier.description ?? '',
    hourly_rate: String(tier.hourly_rate),
    day_rate: String(tier.day_rate),
    monthly_retainer: String(tier.monthly_retainer),
    hosting_maintenance: String(tier.hosting_maintenance),
    fixed_fee_margin: String(tier.fixed_fee_margin),
    is_default: tier.is_default,
  }
}

function CurrencyField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm text-[color:var(--text-2)]">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[color:var(--text-3)]">
          £
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-8 py-3 text-sm text-[color:var(--text)]"
        />
      </div>
    </label>
  )
}

export default function PricingTierSettings({
  pricingTiers,
}: {
  pricingTiers: PricingTier[]
}) {
  const [drafts, setDrafts] = useState<Record<string, DraftTier>>(
    Object.fromEntries(pricingTiers.map((tier) => [tier.id, toDraft(tier)]))
  )
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [errorById, setErrorById] = useState<Record<string, string | null>>({})

  const orderedDrafts = useMemo(
    () => pricingTiers.map((tier) => drafts[tier.id]).filter(Boolean),
    [drafts, pricingTiers]
  )

  function updateDraft(id: string, patch: Partial<DraftTier>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }))
  }

  function markDefaultTier(id: string) {
    setDrafts((current) =>
      Object.fromEntries(
        Object.entries(current).map(([entryId, draft]) => [
          entryId,
          {
            ...draft,
            is_default: entryId === id,
          },
        ])
      )
    )
  }

  async function saveTier(id: string) {
    const draft = drafts[id]
    setSavingId(id)
    setSavedId(null)
    setErrorById((current) => ({ ...current, [id]: null }))

    try {
      const response = await fetch(`/api/pricing-tiers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: draft.description,
          hourly_rate: Number(draft.hourly_rate),
          day_rate: Number(draft.day_rate),
          monthly_retainer: Number(draft.monthly_retainer),
          hosting_maintenance: Number(draft.hosting_maintenance),
          fixed_fee_margin: Number(draft.fixed_fee_margin),
          is_default: draft.is_default,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save pricing tier')
      }

      const savedTier = data.pricing_tier as PricingTier

      setDrafts((current) =>
        Object.fromEntries(
          Object.entries(current).map(([entryId, existingDraft]) => [
            entryId,
            entryId === savedTier.id
              ? toDraft(savedTier)
              : {
                  ...existingDraft,
                  is_default: savedTier.is_default ? false : existingDraft.is_default,
                },
          ])
        )
      )

      setSavedId(id)
      window.setTimeout(() => {
        setSavedId((current) => (current === id ? null : current))
      }, 2000)
    } catch (saveError) {
      setErrorById((current) => ({
        ...current,
        [id]: saveError instanceof Error ? saveError.message : 'Failed to save pricing tier',
      }))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="os-card rounded-[2rem] p-6">
      <div>
        <p className="os-eyebrow">Pricing tiers</p>
        <h2 className="os-section-title mt-2">Pricing tiers</h2>
        <p className="mt-2 text-sm text-[color:var(--text-2)]">
          Set your default rates for each tier. Changes apply to new quotes only - existing
          quotes are not affected.
        </p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {orderedDrafts.map((tier) => (
          <div
            key={tier.id}
            className="os-card rounded-[1.75rem] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-[color:var(--text)]">{tier.name}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--text-3)]">
                  Read-only tier name
                </p>
              </div>
              {tier.is_default ? (
                <span className="rounded-full border border-[color:var(--accent)] bg-[var(--accent-dim)] px-3 py-1 text-xs font-medium text-[color:var(--accent-strong)]">
                  Default
                </span>
              ) : null}
            </div>

            <div className="mt-5 space-y-4">
              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-2)]">Description</span>
                <input
                  value={tier.description}
                  onChange={(event) => updateDraft(tier.id, { description: event.target.value })}
                  className="w-full rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[color:var(--text)]"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <CurrencyField
                  label="Hourly rate"
                  value={tier.hourly_rate}
                  onChange={(value) => updateDraft(tier.id, { hourly_rate: value })}
                />
                <CurrencyField
                  label="Day rate"
                  value={tier.day_rate}
                  onChange={(value) => updateDraft(tier.id, { day_rate: value })}
                />
                <CurrencyField
                  label="Monthly retainer"
                  value={tier.monthly_retainer}
                  onChange={(value) => updateDraft(tier.id, { monthly_retainer: value })}
                />
                <CurrencyField
                  label="Hosting & maintenance"
                  value={tier.hosting_maintenance}
                  onChange={(value) => updateDraft(tier.id, { hosting_maintenance: value })}
                />
              </div>

              <label className="space-y-2">
                <span className="text-sm text-[color:var(--text-2)]">Fixed fee margin</span>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tier.fixed_fee_margin}
                    onChange={(event) =>
                      updateDraft(tier.id, { fixed_fee_margin: event.target.value })
                    }
                    className="w-full rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3 pr-8 text-sm text-[color:var(--text)]"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[color:var(--text-3)]">
                    %
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[color:var(--text-2)]">
                <input
                  type="radio"
                  name="default_pricing_tier"
                  checked={tier.is_default}
                  onChange={() => markDefaultTier(tier.id)}
                  className="h-4 w-4 border-[color:var(--border)] bg-[var(--surface-2)] text-[color:var(--accent)]"
                />
                Default tier
              </label>
            </div>

            {errorById[tier.id] ? (
              <p className="mt-4 text-sm text-[color:var(--red-strong)]">{errorById[tier.id]}</p>
            ) : null}

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => saveTier(tier.id)}
                disabled={savingId !== null}
                className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {savingId === tier.id ? 'Saving...' : 'Save'}
              </button>
              <span className="text-sm text-[color:var(--emerald-strong)]">
                {savedId === tier.id ? 'Saved ✓' : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
