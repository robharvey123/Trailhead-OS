'use client'

import { useActionState } from 'react'
import { updateDisplayName, type ProfileState } from '@/app/(os)/settings/actions'
import { USER_ROLE_LABELS, type UserRole } from '@/lib/types'

export default function ProfileSettingsForm({
  fullName,
  role,
  personName,
}: {
  fullName: string
  role: UserRole
  personName: string | null
}) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(updateDisplayName, {})

  return (
    <form action={formAction} className="mt-5 grid gap-4 md:grid-cols-2">
      <div>
        <label className="field-label" htmlFor="full_name">Full name</label>
        <input
          id="full_name"
          name="full_name"
          defaultValue={fullName}
          className="os-input mt-2 w-full px-3 py-2 text-sm"
        />
      </div>
      <div>
        <p className="os-label">Role</p>
        <p className="mt-2 text-sm text-[color:var(--text)]">{USER_ROLE_LABELS[role]}</p>
        <p className="mt-1 text-xs text-[color:var(--text-3)]">Roles are managed by an admin.</p>
      </div>
      <div>
        <p className="os-label">Linked person</p>
        <p className="mt-2 text-sm text-[color:var(--text)]">{personName ?? 'Not linked'}</p>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="text-xs">
          {state.error ? <span className="text-[color:var(--red-strong)]">{state.error}</span> : null}
          {state.success ? <span className="text-[color:var(--green-strong)]">Saved.</span> : null}
        </div>
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
