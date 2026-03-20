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
      className="rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
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
          <span className="font-medium text-slate-200">Brand filter</span>
          <input
            name="brand_filter"
            defaultValue={settings.brand_filter}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-200">Base currency</span>
          <select
            name="base_currency"
            defaultValue={settings.base_currency}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {ALL_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-slate-200">Supported currencies</span>
          <div className="flex flex-wrap gap-2">
            {ALL_CURRENCIES.map((c) => (
              <label key={c} className="flex items-center gap-1.5 text-sm text-slate-300">
                <input
                  type="checkbox"
                  name="supported_currencies"
                  value={c}
                  defaultChecked={settings.supported_currencies.includes(c)}
                  className="rounded border-slate-600 bg-slate-900"
                />
                {c}
              </label>
            ))}
          </div>
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-200">COGS %</span>
          <input
            name="cogs_pct"
            type="number"
            step="0.01"
            defaultValue={settings.cogs_pct}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-200">Promo cost</span>
          <input
            name="promo_cost"
            type="number"
            step="0.01"
            defaultValue={settings.promo_cost}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </label>
      </div>

      <SubmitButton />

      {state.error ? (
        <p className="text-sm text-rose-200">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-200">Settings saved.</p>
      ) : null}
    </form>
  )
}
