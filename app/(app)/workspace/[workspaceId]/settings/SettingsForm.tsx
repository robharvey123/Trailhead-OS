'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import type { SettingsState } from './actions'
import { updateSettings } from './actions'

type WorkspaceSettings = {
  brand_filter: string
  cogs_pct: number
  promo_cost: number
  currency_symbol: string
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
          <span className="font-medium text-slate-200">Currency symbol</span>
          <input
            name="currency_symbol"
            defaultValue={settings.currency_symbol}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
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
