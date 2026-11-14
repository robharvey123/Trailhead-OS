'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import type { SettingsState } from './actions'
import { updateSettings } from './actions'

const ALL_CURRENCIES = ['GBP', 'EUR', 'USD', 'SEK', 'CHF', 'NOK', 'DKK'] as const

type WorkspaceSettings = {
  brand_filter: string
  cogs_pct: number
  promo_cost: number
  base_currency: string
  supported_currencies: string[]
}

const initialState: SettingsState = {}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn btn-primary"
    >
      {pending ? 'Saving...' : 'Save settings'}
    </button>
  )
}

export default function SettingsForm({
  workspaceId,
  settings,
}: {
  workspaceId: string
  settings: WorkspaceSettings
}) {
  const [state, formAction] = useActionState(updateSettings, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--text)]">Brand filter</span>
          <input
            name="brand_filter"
            defaultValue={settings.brand_filter}
            className="os-input w-full px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--text)]">Base currency</span>
          <select
            name="base_currency"
            defaultValue={settings.base_currency}
            className="os-select w-full px-3 py-2 text-sm"
          >
            {ALL_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-[var(--text)]">Supported currencies</span>
          <div className="flex flex-wrap gap-2">
            {ALL_CURRENCIES.map((c) => (
              <label key={c} className="flex items-center gap-1.5 text-sm text-[var(--text-2)]">
                <input
                  type="checkbox"
                  name="supported_currencies"
                  value={c}
                  defaultChecked={settings.supported_currencies.includes(c)}
                />
                {c}
              </label>
            ))}
          </div>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--text)]">COGS %</span>
          <input
            name="cogs_pct"
            type="number"
            step="0.01"
            defaultValue={settings.cogs_pct}
            className="os-input w-full px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--text)]">Promo cost</span>
          <input
            name="promo_cost"
            type="number"
            step="0.01"
            defaultValue={settings.promo_cost}
            className="os-input w-full px-3 py-2 text-sm"
          />
        </label>
      </div>

      <SubmitButton />

      {state.error ? (
        <p className="text-sm text-[var(--red-strong)]">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-[var(--emerald-strong)]">Settings saved.</p>
      ) : null}
    </form>
  )
}
