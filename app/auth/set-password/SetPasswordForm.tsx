'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setNewPassword } from './actions'
import { authInputClass, authLabelClass } from '@/components/os/AuthShell'
import Button from '@/components/ui/Button'

export default function SetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const input = authInputClass

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
        <label className={authLabelClass} htmlFor="new-password">New password</label>
        <input id="new-password" type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
      </div>
      <div className="space-y-2">
        <label className={authLabelClass} htmlFor="confirm-password">Confirm it</label>
        <input id="confirm-password" type="password" required minLength={10} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
      </div>
      <p className="text-xs text-[var(--text-3)]">At least 10 characters.</p>
      {error ? <p role="alert" className="text-sm text-[var(--red-strong)]">{error}</p> : null}
      <Button type="submit" variant="primary" disabled={pending} className="w-full">
        {pending ? 'Saving…' : 'Save new password'}
      </Button>
    </form>
  )
}
