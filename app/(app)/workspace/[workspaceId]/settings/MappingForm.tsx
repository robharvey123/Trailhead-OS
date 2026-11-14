'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import type { MappingState } from './actions'
import { addMapping } from './actions'

const initialState: MappingState = {}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn btn-primary"
    >
      {pending ? 'Saving...' : 'Add mapping'}
    </button>
  )
}

export default function MappingForm({ workspaceId }: { workspaceId: string }) {
  const [state, formAction] = useActionState(addMapping, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--text)]">Sell In customer</span>
          <input
            name="sell_in_customer"
            required
            className="os-input w-full px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--text)]">Sell Out company</span>
          <input
            name="sell_out_company"
            required
            className="os-input w-full px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="font-medium text-[var(--text)]">Group name</span>
          <input
            name="group_name"
            placeholder="Optional"
            className="os-input w-full px-3 py-2 text-sm"
          />
        </label>
      </div>

      <SubmitButton />

      {state.error ? (
        <p className="text-sm text-[var(--red-strong)]">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-[var(--emerald-strong)]">Mapping added.</p>
      ) : null}
    </form>
  )
}
