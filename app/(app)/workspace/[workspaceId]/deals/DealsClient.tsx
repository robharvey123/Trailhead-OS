'use client'

import { useCallback, useMemo, useState } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { CrmDeal, DealStage } from '@/lib/crm/types'
import { DEAL_STAGES, DEAL_STAGE_LABELS } from '@/lib/crm/types'

type AccountOption = { id: string; name: string }
type ContactOption = { id: string; first_name: string; last_name: string; account_id: string | null }

export default function DealsClient({
  workspaceId,
  initialDeals,
  accounts,
  contacts,
}: {
  workspaceId: string
  initialDeals: CrmDeal[]
  accounts: AccountOption[]
  contacts: ContactOption[]
}) {
  const [deals, setDeals] = useState(initialDeals)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('pipeline')
  const [filterStage, setFilterStage] = useState<string>('all')

  const [title, setTitle] = useState('')
  const [accountId, setAccountId] = useState('')
  const [value, setValue] = useState('')
  const [stage, setStage] = useState<DealStage>('lead')
  const [probability, setProbability] = useState('0')
  const [expectedClose, setExpectedClose] = useState('')
  const [notes, setNotes] = useState('')

  const [contactId, setContactId] = useState('')

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]))
  const contactMap = new Map(contacts.map((c) => [c.id, `${c.first_name} ${c.last_name}`]))

  // Filter contacts by selected account
  const filteredContacts = accountId
    ? contacts.filter((c) => c.account_id === accountId)
    : contacts

  const resetForm = () => {
    setTitle(''); setAccountId(''); setContactId(''); setValue(''); setStage('lead')
    setProbability('0'); setExpectedClose(''); setNotes(''); setEditingId(null)
  }

  const openEdit = (d: CrmDeal) => {
    setTitle(d.title); setAccountId(d.account_id || ''); setContactId(d.contact_id || '')
    setValue(d.value?.toString() || ''); setStage(d.stage)
    setProbability(d.probability.toString()); setExpectedClose(d.expected_close_date || '')
    setNotes(d.notes || ''); setEditingId(d.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
    const payload = {
      workspace_id: workspaceId, title, account_id: accountId || null, contact_id: contactId || null,
      value: value ? parseFloat(value) : null, stage, probability: parseInt(probability) || 0,
      expected_close_date: expectedClose || null, notes: notes || null,
    }
    if (editingId) {
      const { deal } = await apiFetch<{ deal: CrmDeal }>(
        `/api/crm/deals/${editingId}?workspace_id=${workspaceId}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      )
      setDeals((prev) => prev.map((d) => (d.id === editingId ? deal : d)))
    } else {
      const { deal } = await apiFetch<{ deal: CrmDeal }>('/api/crm/deals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      setDeals((prev) => [deal, ...prev])
    }
    resetForm(); setShowForm(false)
    toast.success(editingId ? 'Deal updated' : 'Deal created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }, [workspaceId, editingId, title, accountId, contactId, value, stage, probability, expectedClose, notes])

  const handleStageChange = useCallback(async (dealId: string, newStage: DealStage) => {
    try {
      const { deal } = await apiFetch<{ deal: CrmDeal }>(
        `/api/crm/deals/${dealId}?workspace_id=${workspaceId}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: newStage }) }
      )
      setDeals((prev) => prev.map((d) => (d.id === dealId ? deal : d)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update stage')
    }
  }, [workspaceId])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/crm/deals/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
      setDeals((prev) => prev.filter((d) => d.id !== id))
      toast.success('Deal deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }, [workspaceId])

  const totalPipeline = useMemo(() => {
    return deals.filter((d) => !d.stage.startsWith('closed_')).reduce((sum, d) => sum + (d.value || 0), 0)
  }, [deals])

  const weightedPipeline = useMemo(() => {
    return deals.filter((d) => !d.stage.startsWith('closed_')).reduce((sum, d) => sum + (d.value || 0) * (d.probability / 100), 0)
  }, [deals])

  const wonTotal = useMemo(() => {
    return deals.filter((d) => d.stage === 'closed_won').reduce((sum, d) => sum + (d.value || 0), 0)
  }, [deals])

  const filtered = filterStage === 'all' ? deals : deals.filter((d) => d.stage === filterStage)

  const dealsByStage = useMemo(() => {
    const map = new Map<DealStage, CrmDeal[]>()
    for (const s of DEAL_STAGES) map.set(s, [])
    for (const d of deals) {
      const arr = map.get(d.stage) || []
      arr.push(d)
      map.set(d.stage, arr)
    }
    return map
  }, [deals])

  const fmtCurrency = (v: number | null) => v != null ? `$${v.toLocaleString()}` : '—'

  const onDragEnd = useCallback((result: DropResult) => {
    const { draggableId, destination } = result
    if (!destination) return
    const newStage = destination.droppableId as DealStage
    const deal = deals.find((d) => d.id === draggableId)
    if (!deal || deal.stage === newStage) return
    // Optimistic update
    setDeals((prev) => prev.map((d) => (d.id === draggableId ? { ...d, stage: newStage } : d)))
    handleStageChange(draggableId, newStage)
  }, [deals, handleStageChange])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">CRM</p>
          <h1 className="mt-1 text-2xl font-semibold">Deals</h1>
          <p className="mt-1 text-sm text-slate-400">
            Pipeline: {fmtCurrency(totalPipeline)} &middot; Weighted: {fmtCurrency(weightedPipeline)} &middot; Won: {fmtCurrency(wonTotal)}
          </p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">
          + New Deal
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-700 text-sm">
          {(['pipeline', 'table'] as const).map((mode) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 capitalize transition ${viewMode === mode ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'} ${mode === 'pipeline' ? 'rounded-l-lg' : 'rounded-r-lg'}`}>
              {mode}
            </button>
          ))}
        </div>
        {viewMode === 'table' && (
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
            <option value="all">All stages</option>
            {DEAL_STAGES.map((s) => <option key={s} value={s}>{DEAL_STAGE_LABELS[s]}</option>)}
          </select>
        )}
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Deal' : 'New Deal'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Title *</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                <option value="">No account</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Contact</label>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                <option value="">No contact</option>
                {filteredContacts.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Value ($)</label>
              <input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Stage</label>
              <select value={stage} onChange={(e) => setStage(e.target.value as DealStage)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                {DEAL_STAGES.map((s) => <option key={s} value={s}>{DEAL_STAGE_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Probability (%)</label>
              <input type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Expected Close</label>
              <input type="date" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-400">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white">{editingId ? 'Update' : 'Create'}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Pipeline View */}
      {viewMode === 'pipeline' && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {DEAL_STAGES.map((stg) => {
              const stageDeals = dealsByStage.get(stg) || []
              const stageTotal = stageDeals.reduce((s, d) => s + (d.value || 0), 0)
              return (
                <Droppable droppableId={stg} key={stg}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`w-64 shrink-0 rounded-2xl border bg-slate-900/50 transition-colors ${
                        snapshot.isDraggingOver ? 'border-blue-500/50 bg-blue-950/20' : 'border-slate-800'
                      }`}
                    >
                      <div className="border-b border-slate-800 px-4 py-3">
                        <h3 className="text-sm font-semibold">{DEAL_STAGE_LABELS[stg]}</h3>
                        <p className="text-xs text-slate-400">{stageDeals.length} deals &middot; {fmtCurrency(stageTotal)}</p>
                      </div>
                      <div className="flex flex-col gap-2 p-3" style={{ minHeight: 60 }}>
                        {stageDeals.map((d, index) => (
                          <Draggable draggableId={d.id} index={index} key={d.id}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`rounded-xl border bg-slate-900/80 p-3 transition-shadow ${
                                  dragSnapshot.isDragging ? 'border-blue-500/50 shadow-lg shadow-blue-500/10' : 'border-slate-800'
                                }`}
                              >
                                <p className="text-sm font-medium">{d.title}</p>
                                <p className="mt-1 text-xs text-slate-400">{d.account_id ? accountMap.get(d.account_id) : 'No account'}</p>
                                {d.contact_id && <p className="text-[10px] text-slate-500">{contactMap.get(d.contact_id)}</p>}
                                <p className="mt-1 text-sm font-semibold text-emerald-400">{fmtCurrency(d.value)}</p>
                                <div className="mt-2 flex gap-2">
                                  <button onClick={() => openEdit(d)} className="text-[10px] text-slate-400 hover:text-white">Edit</button>
                                  <button onClick={() => handleDelete(d.id)} className="text-[10px] text-rose-400 hover:text-rose-300">Del</button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {stageDeals.length === 0 && <p className="py-4 text-center text-xs text-slate-600">No deals</p>}
                      </div>
                    </div>
                  )}
                </Droppable>
              )
            })}
          </div>
        </DragDropContext>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Deal</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Prob.</th>
                <th className="px-4 py-3">Close Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No deals found</td></tr>
              ) : filtered.map((d) => (
                <tr key={d.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium">{d.title}</td>
                  <td className="px-4 py-3 text-slate-400">{d.account_id ? accountMap.get(d.account_id) || '—' : '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{d.contact_id ? contactMap.get(d.contact_id) || '—' : '—'}</td>
                  <td className="px-4 py-3 text-emerald-400">{fmtCurrency(d.value)}</td>
                  <td className="px-4 py-3"><span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs">{DEAL_STAGE_LABELS[d.stage]}</span></td>
                  <td className="px-4 py-3 text-slate-400">{d.probability}%</td>
                  <td className="px-4 py-3 text-slate-400">{d.expected_close_date || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(d)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                      <button onClick={() => handleDelete(d.id)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
