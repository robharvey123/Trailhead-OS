'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-fetch'
import { ENGAGEMENT_TYPE_LABELS, type EngagementType, type EngagementWithRelations } from '@/lib/types'

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
  const [engagementType, setEngagementType] = useState<EngagementType>(initial?.engagement_type ?? 'client_consulting')
  const isInternal = engagementType.startsWith('internal')
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
  const [noticeDays, setNoticeDays] = useState(num(initial?.notice_period_days))
  const [autoRenews, setAutoRenews] = useState(initial?.auto_renews ?? false)
  const [renewalTerm, setRenewalTerm] = useState(num(initial?.renewal_term_months))
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

  async function submit() {
    if (!name.trim() || !startDate || (!isInternal && !endClient)) {
      setError(isInternal ? 'Name and start date are required.' : 'Name, end client and start date are required.')
      return
    }
    setSaving(true)
    setError('')
    const body: Record<string, unknown> = {
      engagement_type: engagementType,
      name: name.trim(),
      code: code.trim() || null,
      // Internal engagements have no client and no client-billing fields.
      end_client_account_id: isInternal ? null : endClient,
      billed_via_account_id: isInternal ? null : billedVia || null,
      currency,
      retainer_amount_monthly: isInternal || !retainer ? null : Number(retainer),
      included_hours_monthly: isInternal || !includedHours ? null : Number(includedHours),
      day_rate: isInternal || !dayRate ? null : Number(dayRate),
      performance_fee_default: isInternal || !perfFee ? null : Number(perfFee),
      start_date: startDate,
      end_date: endDate || null,
      notice_period_days: noticeDays ? Number(noticeDays) : null,
      auto_renews: autoRenews,
      renewal_term_months: renewalTerm ? Number(renewalTerm) : null,
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
    <div className="panel mx-auto w-full max-w-[760px] p-4 sm:p-6">
      <h1 className="topbar-title" style={{ marginBottom: 16 }}>{isEdit ? 'Edit engagement' : 'New engagement'}</h1>
      <div className="grid gap-[14px]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="block">
            <span className={label}>Engagement type *</span>
            <select className={input} value={engagementType} onChange={(e) => setEngagementType(e.target.value as EngagementType)}>
              {(Object.keys(ENGAGEMENT_TYPE_LABELS) as EngagementType[]).map((t) => (<option key={t} value={t}>{ENGAGEMENT_TYPE_LABELS[t]}</option>))}
            </select>
          </label>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, paddingBottom: 9 }}>
              {isInternal ? 'Internal · non-billable — cost is tracked from contributor time.' : 'Client · billable.'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="block"><span className={label}>Name *</span><input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder={isInternal ? 'Trailhead OS build' : 'Qola - DRIVER GTM (via Wide Advocacy)'} /></label>
          <label className="block"><span className={label}>Code</span><input className={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="QOLA-GTM" /></label>
        </div>
        {!isInternal ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={label}>End client *</span>
              <select className={input} value={endClient} onChange={(e) => setEndClient(e.target.value)}>
                {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
              </select>
            </label>
            <label className="block">
              <span className={label}>Billed via</span>
              <select className={input} value={billedVia} onChange={(e) => setBilledVia(e.target.value)}>
                <option value="">— direct (end client)</option>
                {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
              </select>
            </label>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block"><span className={label}>Currency</span><input className={input} value={currency} onChange={(e) => setCurrency(e.target.value)} /></label>
          <label className="block"><span className={label}>Start date *</span><input type="date" className={input} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label className="block"><span className={label}>End date</span><input type="date" className={input} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
        </div>
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block"><span className={label}>Notice period (days)</span><input type="number" className={input} value={noticeDays} onChange={(e) => setNoticeDays(e.target.value)} placeholder="30" /></label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, paddingBottom: 8 }}><input type="checkbox" checked={autoRenews} onChange={(e) => setAutoRenews(e.target.checked)} /> Auto-renews</label>
          <label className="block"><span className={label}>Renewal term (months)</span><input type="number" className={input} value={renewalTerm} onChange={(e) => setRenewalTerm(e.target.value)} placeholder="12" /></label>
        </div>
        {!isInternal ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block"><span className={label}>Retainer / mo</span><input type="number" className={input} value={retainer} onChange={(e) => setRetainer(e.target.value)} placeholder="8500" /></label>
            <label className="block"><span className={label}>Included hrs/mo</span><input type="number" className={input} value={includedHours} onChange={(e) => setIncludedHours(e.target.value)} placeholder="40" /></label>
            <label className="block"><span className={label}>Day rate</span><input type="number" className={input} value={dayRate} onChange={(e) => setDayRate(e.target.value)} placeholder="350" /></label>
            <label className="block"><span className={label}>Default perf fee</span><input type="number" className={input} value={perfFee} onChange={(e) => setPerfFee(e.target.value)} placeholder="4000" /></label>
          </div>
        ) : null}

        <div className="card">
          <div className="panel-section-title">Approval thresholds</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block"><span className={label}>Hours overage trigger (h)</span><input type="number" className={input} value={hoursOverage} onChange={(e) => setHoursOverage(e.target.value)} /></label>
            <label className="block"><span className={label}>Travel approval threshold (£)</span><input type="number" className={input} value={travelThreshold} onChange={(e) => setTravelThreshold(e.target.value)} /></label>
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
