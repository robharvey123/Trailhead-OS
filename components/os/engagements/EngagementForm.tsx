'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-fetch'
import { DEFAULT_WORKSTREAMS, type EngagementWithRelations } from '@/lib/types'

type Named = { id: string; name: string }

export default function EngagementForm({ accounts }: { accounts: Named[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [endClient, setEndClient] = useState(accounts[0]?.id ?? '')
  const [billedVia, setBilledVia] = useState('')
  const [currency, setCurrency] = useState('GBP')
  const [retainer, setRetainer] = useState('')
  const [includedHours, setIncludedHours] = useState('')
  const [dayRate, setDayRate] = useState('')
  const [perfFee, setPerfFee] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [workstreams, setWorkstreams] = useState<string[]>([...DEFAULT_WORKSTREAMS])
  const [wsInput, setWsInput] = useState('')
  const [hoursOverage, setHoursOverage] = useState('8')
  const [travelThreshold, setTravelThreshold] = useState('250')
  const [slotting, setSlotting] = useState(true)
  const [exhibition, setExhibition] = useState(true)
  const [thirdParty, setThirdParty] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const input =
    'w-full rounded-[5px] border border-[#252a38] bg-[#1a1e28] px-3 py-2 text-sm text-[#e8eaf2] outline-none focus:border-[#4f6ef7]'
  const label = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-[#565c78]'

  function addWorkstream() {
    const v = wsInput.trim()
    if (v && !workstreams.includes(v)) setWorkstreams((w) => [...w, v])
    setWsInput('')
  }

  async function submit() {
    if (!name.trim() || !endClient || !startDate) {
      setError('Name, end client and start date are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { engagement } = await apiFetch<{ engagement: EngagementWithRelations }>('/api/engagements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || null,
          end_client_account_id: endClient,
          billed_via_account_id: billedVia || null,
          currency,
          retainer_amount_monthly: retainer ? Number(retainer) : null,
          included_hours_monthly: includedHours ? Number(includedHours) : null,
          day_rate: dayRate ? Number(dayRate) : null,
          performance_fee_default: perfFee ? Number(perfFee) : null,
          start_date: startDate,
          end_date: endDate || null,
          workstreams,
          status: 'Active',
          approval_thresholds: {
            hours_overage_hours: Number(hoursOverage) || 0,
            travel_amount_gbp: Number(travelThreshold) || 0,
            slotting_fees_required: slotting,
            exhibition_required: exhibition,
            third_party_costs_required: thirdParty,
          },
        }),
      })
      router.push(`/engagements/${engagement.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create engagement')
      setSaving(false)
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 760, margin: '0 auto', padding: 24 }}>
      <h1 className="topbar-title" style={{ marginBottom: 16 }}>New engagement</h1>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div><label className={label}>Name *</label><input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Qola - DRIVER GTM (via Wide Advocacy)" /></div>
          <div><label className={label}>Code</label><input className={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="QOLA-GTM" /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className={label}>End client *</label>
            <select className={input} value={endClient} onChange={(e) => setEndClient(e.target.value)}>
              {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
            </select>
          </div>
          <div>
            <label className={label}>Billed via</label>
            <select className={input} value={billedVia} onChange={(e) => setBilledVia(e.target.value)}>
              <option value="">— direct (end client)</option>
              {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <div><label className={label}>Currency</label><input className={input} value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
          <div><label className={label}>Retainer / mo</label><input type="number" className={input} value={retainer} onChange={(e) => setRetainer(e.target.value)} placeholder="8500" /></div>
          <div><label className={label}>Included hrs/mo</label><input type="number" className={input} value={includedHours} onChange={(e) => setIncludedHours(e.target.value)} placeholder="40" /></div>
          <div><label className={label}>Day rate</label><input type="number" className={input} value={dayRate} onChange={(e) => setDayRate(e.target.value)} placeholder="350" /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div><label className={label}>Default perf fee</label><input type="number" className={input} value={perfFee} onChange={(e) => setPerfFee(e.target.value)} placeholder="4000" /></div>
          <div><label className={label}>Start date *</label><input type="date" className={input} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div><label className={label}>End date</label><input type="date" className={input} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        </div>

        <div>
          <label className={label}>Workstreams</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {workstreams.map((w) => (
              <span key={w} className="tag-chip accent">
                {w}
                <button onClick={() => setWorkstreams((ws) => ws.filter((x) => x !== w))}>✕</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className={input} value={wsInput} onChange={(e) => setWsInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWorkstream() } }} placeholder="Add a workstream…" />
            <button className="btn btn-ghost btn-sm" onClick={addWorkstream}>Add</button>
          </div>
        </div>

        <div className="card">
          <div className="panel-section-title">Approval thresholds</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className={label}>Hours overage trigger (h)</label><input type="number" className={input} value={hoursOverage} onChange={(e) => setHoursOverage(e.target.value)} /></div>
            <div><label className={label}>Travel approval threshold (£)</label><input type="number" className={input} value={travelThreshold} onChange={(e) => setTravelThreshold(e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={slotting} onChange={(e) => setSlotting(e.target.checked)} /> Slotting fees require approval</label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={exhibition} onChange={(e) => setExhibition(e.target.checked)} /> Exhibitions</label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={thirdParty} onChange={(e) => setThirdParty(e.target.checked)} /> Third-party costs</label>
          </div>
        </div>

        {error ? <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p> : null}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/engagements')}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create engagement'}</button>
        </div>
      </div>
    </div>
  )
}
