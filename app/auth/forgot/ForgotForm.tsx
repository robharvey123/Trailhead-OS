'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from './actions'
import { authInputClass, authLabelClass, authLinkClass } from '@/components/os/AuthShell'
import Button from '@/components/ui/Button'

export default function ForgotForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, startTransition] = useTransition()

  if (sent) {
    return (
      <div className="mt-6 space-y-4 text-sm text-[var(--text-2)]">
        <p>If that email has an account, a reset link is on its way. It works once and expires soon.</p>
        <Link href="/login" className={authLinkClass}>Back to sign in</Link>
      </div>
    )
  }

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          const res = await requestPasswordReset(email)
          if (!res.ok) setError(res.error)
          else setSent(true)
        })
      }}
    >
      <div className="space-y-2">
        <label className={authLabelClass} htmlFor="forgot-email">Email</label>
        <input
          id="forgot-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={authInputClass}
        />
      </div>
      {error ? <p role="alert" className="text-sm text-[var(--red-strong)]">{error}</p> : null}
      <Button type="submit" variant="primary" disabled={pending} className="w-full">
        {pending ? 'Sending…' : 'Email me a reset link'}
      </Button>
      <p className="text-center text-sm"><Link href="/login" className={authLinkClass}>Back to sign in</Link></p>
    </form>
  )
}
