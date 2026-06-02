'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-fetch'
import { markdownToHtml } from '@/lib/templates/weeklyUpdate'

export default function WeeklyUpdateClient({
  engagementId, weekStart, initialMarkdown, to, cc, subject: initialSubject,
}: {
  engagementId: string
  weekStart: string
  initialMarkdown: string
  to: string[]
  cc: string[]
  subject: string
}) {
  const router = useRouter()
  const [md, setMd] = useState(initialMarkdown)
  const [toStr, setToStr] = useState(to.join(', '))
  const [ccStr, setCcStr] = useState(cc.join(', '))
  const [subject, setSubject] = useState(initialSubject)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const input = 'w-full rounded-[5px] border border-[#252a38] bg-[#1a1e28] px-3 py-2 text-sm text-[#e8eaf2] outline-none focus:border-[#4f6ef7]'
  const label = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#565c78]'

  async function saveDraft() {
    setBusy(true); setMsg('')
    try {
      await apiFetch(`/api/engagements/${engagementId}/documents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'weekly_update', title: subject, body_markdown: md, week_start: weekStart }),
      })
      setMsg('Draft saved.')
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Failed to save draft') } finally { setBusy(false) }
  }

  async function sendGmail() {
    if (!toStr.trim()) { setMsg('Add at least one recipient.'); return }
    setBusy(true); setMsg('')
    try {
      await apiFetch('/api/gmail/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: toStr, cc: ccStr, subject, body: markdownToHtml(md) }),
      })
      await apiFetch(`/api/engagements/${engagementId}/documents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'weekly_update', title: subject, body_markdown: md, week_start: weekStart }),
      })
      setMsg('Sent via Gmail and saved.')
    } catch (err) { setMsg(err instanceof Error ? err.message : 'Failed to send') } finally { setBusy(false) }
  }

  function exportPdf() {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<html><head><title>${subject}</title><style>body{font-family:Inter,system-ui,sans-serif;max-width:720px;margin:40px auto;color:#111;line-height:1.5}h1{font-size:22px}h2{font-size:15px;margin-top:24px}ul{padding-left:18px}</style></head><body>${markdownToHtml(md)}</body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  return (
    <div className="panel" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="topbar">
        <button className="td-mono" style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }} onClick={() => router.push(`/engagements/${engagementId}`)}>‹ Engagement</button>
        <span className="topbar-title">Weekly update</span>
        <span className="topbar-count">week of {weekStart}</span>
        <div className="topbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={saveDraft} disabled={busy}>Save draft</button>
          <button className="btn btn-ghost btn-sm" onClick={exportPdf}>Export PDF</button>
          <button className="btn btn-primary btn-sm" onClick={sendGmail} disabled={busy}>↗ Send via Gmail</button>
        </div>
      </div>

      <div style={{ padding: 24, display: 'grid', gap: 14 }}>
        {msg ? <p style={{ fontSize: 13, color: 'var(--accent)' }}>{msg}</p> : null}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label className={label}>To</label><input className={input} value={toStr} onChange={(e) => setToStr(e.target.value)} placeholder="client@…" /></div>
          <div><label className={label}>Cc</label><input className={input} value={ccStr} onChange={(e) => setCcStr(e.target.value)} placeholder="agency@…" /></div>
        </div>
        <div><label className={label}>Subject</label><input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div>
          <label className={label}>Body (Markdown — edit before sending)</label>
          <textarea className={`${input} font-mono`} style={{ minHeight: 420, resize: 'vertical', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }} value={md} onChange={(e) => setMd(e.target.value)} />
        </div>
      </div>
    </div>
  )
}
