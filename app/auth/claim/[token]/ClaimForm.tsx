'use client'

import { useState } from 'react'
import { claimInvite } from '../actions'

export default function ClaimForm({ token, email }: { token: string; email: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const input = 'w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'
  const label = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]'

  async function submit() {
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true); setError('')
    try {
      // On success the server action redirects to /settings (throws NEXT_REDIRECT).
      const res = await claimInvite(token, password)
      if (res?.error) { setError(res.error); setBusy(false) }
    } catch (err) {
      // Re-throw Next.js redirect; surface anything else.
      if (err && typeof err === 'object' && 'digest' in err && String((err as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) throw err
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div><label className={label}>Email</label><input className={input} value={email} readOnly disabled /></div>
      <div><label className={label}>Password</label><input className={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></div>
      <div><label className={label}>Confirm password</label><input className={input} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
      {error ? <p style={{ color: 'var(--red)', fontSize: 12 }}>{error}</p> : null}
      <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>{busy ? 'Setting up…' : 'Claim account'}</button>
    </div>
  )
}
