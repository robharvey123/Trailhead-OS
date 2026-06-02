'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-fetch'
import { DEFAULT_WORKSTREAMS, type EngagementWithRelations } from '@/lib/types'

type Named = { id: string; name: string }

const num = (v: number | null | undefined) => (v == null ? '' : String(v))

export default function EngagementForm({
  accounts,
  initial,
  onCancel,
  onSaved,
}: {
  accounts: Named[]
  /** When set, the form edits this engagement (PATCH) instead of creating a new one. */
  initial?: EngagementWithRelations
  /** Overrides the default "go to /engagements" cancel behaviour (e.g. close a modal). */
  onCancel?: () => void
  /** Overrides the default "navigate to the engagement" save behaviour. */
  onSaved?: (engagement: EngagementWithRelations) => void
}) {
  const router = useRouter()
  const isEdit = !!initial?.id
  const at = initial?.approval_thresholds
  const [name, setName] = useState(initial?.name ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [endClient, setEndClient] = useState(initial?.end_client_account_id ?? accounts[0]?.id ?? '')
  const [billedVia, setBilledVia] = useState(initial?.billed_via_account_id ?? '')
  const [currency, setCurrency] = useState(initial?.currency ?? 'GBP')
  const [retainer, setRetainer] = useState(num(initial?.retainer_amount_monthly))
  const [includedHours, setIncludedHours] = useState(num(initial?.included_hours_monthly))
  const [dayRate, setDayRate] = useState(num(initial?.day_rate))
  const [perfFee, setPerfFee] = useState(num(initial?.performance_fee_default))
  const [startDate, setStartDate] = useState(initial?.start_date ?? new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(initial?.end_date ?? '')
  const [workstreams, setWorkstreams] = useState<string[]>(initial?.workstreams ?? [...DEFAULT_WORKSTREAMS])
  const [wsInput, setWsInput] = useState('')
  const [hoursOverage, setHoursOverage] = useState(num(at?.hours_overage_hours) || '8')
  const [travelThreshold, setTravelThreshold] = useState(num(at?.travel_amount_gbp) || '250')
  const [slotting, setSlotting] = useState(at?.slotting_fees_required ?? true)
  const [exhibition, setExhibition] = useState(at?.exhibition_required ?? true)
  const [thirdParty, setThirdParty] = useState(at?.third_party_costs_required ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const input =
    'w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'
  const label = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]'

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
    const body: Record<string, unknown> = {
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
      approval_thresholds: {
        hours_overage_hours: Number(hoursOverage) || 0,
        travel_amount_gbp: Number(travelThreshold) || 0,
        slotting_fees_required: slotting,
        exhibition_required: exhibition,
        third_party_costs_required: thirdParty,
      },
    }
    // Only stamp status on create — editing must not silently re-activate a paused/terminated engagement.
    if (!isEdit) body.status = 'Active'
    try {
      const { engagement } = await apiFetch<{ engagement: EngagementWithRelations }>(
        isEdit ? `/api/engagements/${initial!.id}` : '/api/engagements',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      if (onSaved) onSaved(engagement)
      else router.push(`/engagements/${engagement.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'create'} engagement`)
      setSaving(false)
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 760, margin: '0 auto', padding: 24 }}>
      <h1 className="topbar-title" style={{ marginBottom: 16 }}>{isEdit ? 'Edit engagement' : 'New engagement'}</h1>
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
          <button className="btn btn-ghost btn-sm" onClick={() => (onCancel ? onCancel() : router.push('/engagements'))}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={saving}>
            {saving ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save changes' : 'Create engagement'}
          </button>
        </div>
      </div>
    </div>
  )
}
