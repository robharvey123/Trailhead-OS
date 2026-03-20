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
      className="rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
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
        <label className="text-sm font-medium" htmlFor="workspace-name">
          Workspace name
        </label>
        <input
          id="workspace-name"
          name="name"
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
          placeholder="Acme Brands"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="workspace-type">
          Type
        </label>
        <select
          id="workspace-type"
          name="type"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
          defaultValue="brand"
        >
          <option value="brand">Brand</option>
          <option value="holding">Holding Company</option>
        </select>
      </div>
      <SubmitButton />
      {state.error ? (
        <p className="text-sm text-rose-200">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-200">Workspace created.</p>
      ) : null}
    </form>
  )
}
