'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from './actions'

export default function ForgotForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, startTransition] = useTransition()

  if (sent) {
    return (
      <div className="mt-6 space-y-4 text-sm text-slate-300">
        <p>If that email has an account, a reset link is on its way. It works once and expires soon.</p>
        <Link href="/login" className="text-white underline">Back to sign in</Link>
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
        <label className="text-sm font-medium" htmlFor="forgot-email">Email</label>
        <input
          id="forgot-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
        />
      </div>
      {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? 'Sending…' : 'Email me a reset link'}
      </button>
      <p className="text-center text-sm"><Link href="/login" className="text-slate-300 hover:text-white">Back to sign in</Link></p>
    </form>
  )
}
