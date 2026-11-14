"use client"

import type { FormEvent } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import AuthShell, { authInputClass, authLabelClass, authLinkClass } from '@/components/os/AuthShell'
import Button from '@/components/ui/Button'

export default function LoginForm({ nextPath, initialMessage = null }: { nextPath: string; initialMessage?: string | null }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(initialMessage)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    // Sign-in only. Accounts are created by invite (admin/invites), never by
    // self sign-up: a new profile would otherwise get a working role.
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      router.replace(nextPath)
    }

    setIsSubmitting(false)
  }

  return (
    <AuthShell title="Sign in to Trailhead OS" description="Use your email and password.">
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className={authLabelClass} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className={authInputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className={authLabelClass} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className={authInputClass}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm">
        <a href="/auth/forgot" className={authLinkClass}>Forgot password?</a>
      </p>

      {message ? (
        <p role="alert" className="mt-4 text-sm text-[var(--red-strong)]">{message}</p>
      ) : null}
    </AuthShell>
  )
}
