'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { MarketingCampaign, CampaignType, CampaignStatus, CampaignChannel } from '@/lib/marketing/types'
import { CAMPAIGN_TYPES, CAMPAIGN_TYPE_LABELS, CAMPAIGN_STATUSES, CAMPAIGN_STATUS_LABELS, CAMPAIGN_CHANNELS, CAMPAIGN_CHANNEL_LABELS } from '@/lib/marketing/types'

export default function CampaignsClient({ workspaceId, initialCampaigns }: { workspaceId: string; initialCampaigns: MarketingCampaign[] }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search, setSearch] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<CampaignType>('promotion')
  const [status, setStatus] = useState<CampaignStatus>('draft')
  const [channel, setChannel] = useState<CampaignChannel | ''>('')
  const [budgetAllocated, setBudgetAllocated] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [goals, setGoals] = useState('')

  const resetForm = () => { setName(''); setDescription(''); setType('promotion'); setStatus('draft'); setChannel(''); setBudgetAllocated(''); setStartDate(''); setEndDate(''); setTargetAudience(''); setGoals(''); setEditingId(null) }

  const openEdit = (c: MarketingCampaign) => {
    setName(c.name); setDescription(c.description || ''); setType(c.type); setStatus(c.status)
    setChannel(c.channel || ''); setBudgetAllocated(c.budget_allocated?.toString() || ''); setStartDate(c.start_date || '')
    setEndDate(c.end_date || ''); setTargetAudience(c.target_audience || ''); setGoals(c.goals || '')
    setEditingId(c.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
    const payload = {
      workspace_id: workspaceId, name, description: description || null, type, status,
      channel: channel || null, budget_allocated: budgetAllocated ? parseFloat(budgetAllocated) : 0,
      start_date: startDate || null, end_date: endDate || null,
      target_audience: targetAudience || null, goals: goals || null,
    }
    if (editingId) {
      const { campaign } = await apiFetch<{ campaign: MarketingCampaign }>(`/api/marketing/campaigns/${editingId}?workspace_id=${workspaceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setCampaigns((prev) => prev.map((c) => c.id === editingId ? campaign : c))
    } else {
      const { campaign } = await apiFetch<{ campaign: MarketingCampaign }>('/api/marketing/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setCampaigns((prev) => [campaign, ...prev])
    }
    resetForm(); setShowForm(false)
    toast.success(editingId ? 'Campaign updated' : 'Campaign created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }, [workspaceId, editingId, name, description, type, status, channel, budgetAllocated, startDate, endDate, targetAudience, goals])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/marketing/campaigns/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      toast.success('Campaign deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }, [workspaceId])

  const filtered = campaigns.filter((c) => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (search) { const q = search.toLowerCase(); return c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) }
    return true
  })

  const fmtCurrency = (v: number) => v ? `$${v.toLocaleString()}` : '—'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Marketing</p>
          <h1 className="mt-1 text-2xl font-semibold">Campaigns</h1>
          <p className="mt-1 text-sm text-slate-400">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ New Campaign</button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
          <option value="all">All statuses</option>
          {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{CAMPAIGN_STATUS_LABELS[s]}</option>)}
        </select>
        <input type="text" placeholder="Search campaigns..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500" />
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Campaign' : 'New Campaign'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><label className="mb-1 block text-xs text-slate-400">Name *</label><input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            <div><label className="mb-1 block text-xs text-slate-400">Type</label><select value={type} onChange={(e) => setType(e.target.value as CampaignType)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{CAMPAIGN_TYPES.map((t) => <option key={t} value={t}>{CAMPAIGN_TYPE_LABELS[t]}</option>)}</select></div>
            <div><label className="mb-1 block text-xs text-slate-400">Status</label><select value={status} onChange={(e) => setStatus(e.target.value as CampaignStatus)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{CAMPAIGN_STATUS_LABELS[s]}</option>)}</select></div>
            <div><label className="mb-1 block text-xs text-slate-400">Channel</label><select value={channel} onChange={(e) => setChannel(e.target.value as CampaignChannel)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">None</option>{CAMPAIGN_CHANNELS.map((c) => <option key={c} value={c}>{CAMPAIGN_CHANNEL_LABELS[c]}</option>)}</select></div>
            <div><label className="mb-1 block text-xs text-slate-400">Budget</label><input type="number" step="0.01" value={budgetAllocated} onChange={(e) => setBudgetAllocated(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            <div><label className="mb-1 block text-xs text-slate-400">Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            <div><label className="mb-1 block text-xs text-slate-400">End Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            <div><label className="mb-1 block text-xs text-slate-400">Target Audience</label><input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            <div className="sm:col-span-2"><label className="mb-1 block text-xs text-slate-400">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            <div className="sm:col-span-2"><label className="mb-1 block text-xs text-slate-400">Goals</label><textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white">{editingId ? 'Update' : 'Create'}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <div key={c.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-semibold">{c.name}</h3>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase">{CAMPAIGN_STATUS_LABELS[c.status]}</span>
            </div>
            {c.description && <p className="mt-2 text-xs text-slate-400 line-clamp-2">{c.description}</p>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
              <span>{CAMPAIGN_TYPE_LABELS[c.type]}</span>
              {c.channel && <span>&middot; {CAMPAIGN_CHANNEL_LABELS[c.channel]}</span>}
              {c.budget_allocated > 0 && <span>&middot; Budget: {fmtCurrency(c.budget_allocated)}</span>}
            </div>
            {(c.start_date || c.end_date) && (
              <p className="mt-2 text-xs text-slate-500">{c.start_date || '?'} → {c.end_date || '?'}</p>
            )}
            <div className="mt-3 flex gap-2">
              <button onClick={() => openEdit(c)} className="text-xs text-slate-400 hover:text-white">Edit</button>
              <button onClick={() => handleDelete(c.id)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="col-span-full py-8 text-center text-sm text-slate-500">No campaigns found</p>}
      </div>
    </div>
  )
}
