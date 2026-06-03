'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ASSIGNABLE_ROLES, USER_ROLE_LABELS, type Invite, type UserRole } from '@/lib/types'
import { createInvite, revokeInvite } from './actions'

type Named = { id: string; name: string }

function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

function statusOf(inv: Invite): { label: string; cls: string } {
  if (inv.claimed_at) return { label: 'Claimed', cls: 'status-active' }
  if (new Date(inv.expires_at) < new Date()) return { label: 'Expired', cls: 'status-declined' }
  return { label: 'Pending', cls: 'status-contacted' }
}

export default function InvitesClient({ invites, people }: { invites: Invite[]; people: Named[] }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('employee')
  const [personPick, setPersonPick] = useState('')
  const [newName, setNewName] = useState('')
  const [newRate, setNewRate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [createdLink, setCreatedLink] = useState<{ link: string; emailed: boolean } | null>(null)
  const [copied, setCopied] = useState(false)

  async function submit() {
    if (!email.trim()) { setError('Email is required.'); return }
    if (personPick === '__new__' && !newName.trim()) { setError('New person needs a name.'); return }
    setBusy(true); setError(''); setCreatedLink(null)
    try {
      const res = await createInvite({
        email: email.trim(),
        role,
        personId: personPick && personPick !== '__new__' ? personPick : undefined,
        newPerson: personPick === '__new__' ? { fullName: newName.trim(), defaultRate: newRate ? Number(newRate) : undefined } : undefined,
      })
      setCreatedLink({ link: res.link, emailed: res.emailed })
      setEmail(''); setPersonPick(''); setNewName(''); setNewRate('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    setError('')
    try {
      await revokeInvite(id)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invite')
    }
  }

  async function copyLink() {
    if (!createdLink) return
    try {
      await navigator.clipboard.writeText(createdLink.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard may be blocked; link is shown for manual copy */ }
  }

  const input = 'w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'
  const label = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]'

  return (
    <div className="panel overflow-hidden">
      <div className="topbar">
        <span className="topbar-title">Invites</span>
        <span className="topbar-count">{invites.filter((i) => !i.claimed_at && new Date(i.expires_at) >= new Date()).length} pending</span>
      </div>

      <div style={{ padding: 24, display: 'grid', gap: 20 }}>
        <div className="card">
          <div className="panel-section-title">Send an invite</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div><label className={label}>Email *</label><input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@company.com" /></div>
            <div>
              <label className={label}>Role</label>
              <select className={input} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                {ASSIGNABLE_ROLES.map((r) => (<option key={r} value={r}>{USER_ROLE_LABELS[r]}</option>))}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className={label}>Link to person</label>
            <select className={input} value={personPick} onChange={(e) => setPersonPick(e.target.value)}>
              <option value="">— none</option>
              {people.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              <option value="__new__">➕ Create new person…</option>
            </select>
          </div>
          {personPick === '__new__' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginTop: 12 }}>
              <div><label className={label}>Full name *</label><input className={input} value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
              <div><label className={label}>Default rate £/h</label><input className={input} type="number" value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder="optional" /></div>
            </div>
          ) : null}
          {error ? <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 10 }}>{error}</p> : null}
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Send invite'}</button>
          </div>

          {createdLink ? (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>
                Invite created{createdLink.emailed ? ' and emailed' : ' (email not sent — share this link)'}. Claim link:
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className={input} readOnly value={createdLink.link} onFocus={(e) => e.currentTarget.select()} />
                <button className="btn btn-ghost btn-sm" onClick={copyLink}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
            </div>
          ) : null}
        </div>

        {invites.length === 0 ? <div className="empty">No invites yet.</div> : (
          <table className="data-table">
            <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Expires</th><th></th></tr></thead>
            <tbody>
              {invites.map((inv) => {
                const s = statusOf(inv)
                const pending = !inv.claimed_at && new Date(inv.expires_at) >= new Date()
                return (
                  <tr key={inv.id}>
                    <td className="td-name">{inv.email}</td>
                    <td>{USER_ROLE_LABELS[inv.role]}</td>
                    <td><span className={`status-badge ${s.cls}`}>{s.label}</span></td>
                    <td className="td-mono">{fmtDate(inv.expires_at)}</td>
                    <td>{pending ? <button className="btn btn-ghost btn-sm" onClick={() => revoke(inv.id)} style={{ color: 'var(--red)' }}>Revoke</button> : null}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
