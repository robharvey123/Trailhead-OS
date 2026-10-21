'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setNewPassword } from './actions'

export default function SetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const input = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none'

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          const res = await setNewPassword(password, confirm)
          if (!res.ok) {
            setError(res.error)
            return
          }
          router.replace(res.next)
        })
      }}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="new-password">New password</label>
        <input id="new-password" type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="confirm-password">Confirm it</label>
        <input id="confirm-password" type="password" required minLength={10} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
      </div>
      <p className="text-xs text-slate-400">At least 10 characters.</p>
      {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70">
        {pending ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  )
}
