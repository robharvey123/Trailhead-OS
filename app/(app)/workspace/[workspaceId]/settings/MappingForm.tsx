'use client'

import { useFormState, useFormStatus } from 'react-dom'
import type { MappingState } from './actions'
import { addMapping } from './actions'

const initialState: MappingState = {}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? 'Saving...' : 'Add mapping'}
    </button>
  )
}

export default function MappingForm({ workspaceId }: { workspaceId: string }) {
  const [state, formAction] = useFormState(addMapping, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-200">Sell In customer</span>
          <input
            name="sell_in_customer"
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-200">Sell Out company</span>
          <input
            name="sell_out_company"
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-200">Group name</span>
          <input
            name="group_name"
            placeholder="Optional"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </label>
      </div>

      <SubmitButton />

      {state.error ? (
        <p className="text-sm text-rose-200">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-200">Mapping added.</p>
      ) : null}
    </form>
  )
}
