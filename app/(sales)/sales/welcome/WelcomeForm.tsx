'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { completeSalesSetup } from './actions'

export default function WelcomeForm({ initialName }: { initialName: string }) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
          const res = await completeSalesSetup({ displayName: name, password })
          if (!res.ok) {
            setError(res.error)
            return
          }
          router.replace('/sales/dashboard')
        })
      }}
    >
      <div>
        <label htmlFor="welcome-name" className="field-label block">Your name</label>
        <input id="welcome-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required
          className="os-input w-full px-3 py-2 text-sm" />
      </div>
      <div>
        <label htmlFor="welcome-password" className="field-label block">Choose a password</label>
        <input id="welcome-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={10}
          className="os-input w-full px-3 py-2 text-sm" />
        <p className="mt-1 text-xs text-[color:var(--text-3)]">At least 10 characters. You will use this with your email to sign in from now on.</p>
      </div>
      {error ? <p role="alert" className="text-sm text-[color:var(--red-strong)]">{error}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save and go to my dashboard'}</button>
    </form>
  )
}
