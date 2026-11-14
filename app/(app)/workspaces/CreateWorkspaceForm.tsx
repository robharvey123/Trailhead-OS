'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import type { CreateWorkspaceState } from './actions'
import { createWorkspace } from './actions'

const initialState: CreateWorkspaceState = {}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn btn-primary"
    >
      {pending ? 'Creating...' : 'Create workspace'}
    </button>
  )
}

export default function CreateWorkspaceForm() {
  const [state, formAction] = useActionState(createWorkspace, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--text)]" htmlFor="workspace-name">
          Workspace name
        </label>
        <input
          id="workspace-name"
          name="name"
          required
          className="os-input w-full px-3 py-2 text-sm"
          placeholder="Acme Brands"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--text)]" htmlFor="workspace-type">
          Type
        </label>
        <select
          id="workspace-type"
          name="type"
          className="os-select w-full px-3 py-2 text-sm"
          defaultValue="brand"
        >
          <option value="brand">Brand</option>
          <option value="holding">Holding Company</option>
        </select>
      </div>
      <SubmitButton />
      {state.error ? (
        <p className="text-sm text-[var(--red-strong)]">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-[var(--emerald-strong)]">Workspace created.</p>
      ) : null}
    </form>
  )
}
