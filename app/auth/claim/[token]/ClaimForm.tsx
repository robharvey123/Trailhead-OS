'use client'

import { useState } from 'react'
import { claimInvite } from '../actions'
import { authInputClass } from '@/components/os/AuthShell'
import Button from '@/components/ui/Button'

export default function ClaimForm({ token, email }: { token: string; email: string }) {
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const input = authInputClass
  const label = 'field-label block'

  async function submit() {
    if (!fullName.trim()) { setError('Please enter your full name.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true); setError('')
    try {
      // On success the server action redirects to /settings (throws NEXT_REDIRECT).
      const res = await claimInvite(token, password, fullName.trim())
      if (res?.error) { setError(res.error); setBusy(false) }
    } catch (err) {
      // Re-throw Next.js redirect; surface anything else.
      if (err && typeof err === 'object' && 'digest' in err && String((err as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) throw err
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-3">
      <div><label className={label}>Email</label><input className={input} value={email} readOnly disabled /></div>
      <div><label className={label}>Full name</label><input className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Rob Harvey" autoFocus /></div>
      <div><label className={label}>Password</label><input className={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></div>
      <div><label className={label}>Confirm password</label><input className={input} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
      {error ? <p role="alert" className="text-sm text-[var(--red-strong)]">{error}</p> : null}
      <Button variant="primary" onClick={submit} disabled={busy} className="mt-1 w-full">{busy ? 'Setting up…' : 'Claim account'}</Button>
    </div>
  )
}
