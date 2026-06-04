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
        <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]" htmlFor="full_name">Full name</label>
        <input
          id="full_name"
          name="full_name"
          defaultValue={fullName}
          className="mt-2 w-full rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[color:var(--text)] outline-none focus:border-[color:var(--accent)]"
        />
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">Role</p>
        <p className="mt-2 text-sm text-[color:var(--text)]">{USER_ROLE_LABELS[role]}</p>
        <p className="mt-1 text-xs text-[color:var(--text-3)]">Roles are managed by an admin.</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">Linked person</p>
        <p className="mt-2 text-sm text-[color:var(--text)]">{personName ?? 'Not linked'}</p>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="text-xs">
          {state.error ? <span className="text-[color:var(--red)]">{state.error}</span> : null}
          {state.success ? <span className="text-[color:var(--green)]">Saved.</span> : null}
        </div>
        <button type="submit" disabled={pending} className="rounded-2xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
