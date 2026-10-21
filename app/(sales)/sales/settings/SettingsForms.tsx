'use client'

import { useState, useTransition } from 'react'
import { saveSenderIdentity, saveSendingDomains } from './actions'

const input = 'w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'
const label = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-3)]'

function useAction() {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    setMsg(null)
    start(async () => {
      const res = await fn()
      setMsg(res.ok ? { ok: true, text: success } : { ok: false, text: res.error })
    })
  }
  return { pending, msg, run }
}

export function SenderIdentityForm({ initial }: { initial: { fromName: string; fromEmail: string; replyTo: string } }) {
  const [v, setV] = useState(initial)
  const { pending, msg, run } = useAction()
  return (
    <form
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveSenderIdentity(v), 'Saved. Follow-ups now send from this address.')
      }}
    >
      <div><label className={label} htmlFor="sid-name">From name</label><input id="sid-name" className={input} value={v.fromName} onChange={(e) => setV({ ...v, fromName: e.target.value })} placeholder="Francesca at Engineer OS" /></div>
      <div><label className={label} htmlFor="sid-email">From email</label><input id="sid-email" type="email" className={input} value={v.fromEmail} onChange={(e) => setV({ ...v, fromEmail: e.target.value })} placeholder="francesca@engineeros.uk" /></div>
      <div><label className={label} htmlFor="sid-reply">Reply-to</label><input id="sid-reply" type="email" className={input} value={v.replyTo} onChange={(e) => setV({ ...v, replyTo: e.target.value })} placeholder="same as from" /></div>
      <div className="flex items-center gap-3 sm:col-span-3">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>{pending ? 'Checking…' : 'Save'}</button>
        <span role="status" className="text-xs">{msg ? <span className={msg.ok ? 'text-[color:var(--text-2)]' : 'text-[color:var(--red)]'}>{msg.text}</span> : null}</span>
      </div>
    </form>
  )
}

export function SendingDomainsForm({ initial }: { initial: string[] }) {
  const [v, setV] = useState(initial.join(', '))
  const { pending, msg, run } = useAction()
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveSendingDomains(v), 'Saved.')
      }}
    >
      <div>
        <label className={label} htmlFor="domains">Allowed sending domains</label>
        <input id="domains" className={input} value={v} onChange={(e) => setV(e.target.value)} placeholder="engineeros.uk, mail.engineeros.uk" />
        <p className="mt-1 text-xs text-[color:var(--text-3)]">Comma separated. Each must also be verified in Resend before anyone can send from it.</p>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-ghost btn-sm" disabled={pending}>{pending ? 'Saving…' : 'Save domains'}</button>
        <span role="status" className="text-xs">{msg ? <span className={msg.ok ? 'text-[color:var(--text-2)]' : 'text-[color:var(--red)]'}>{msg.text}</span> : null}</span>
      </div>
    </form>
  )
}
