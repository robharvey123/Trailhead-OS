'use client'

import { useCallback, useState } from 'react'
import type { SupplyOrder, SupplyOrderStatus } from '@/lib/supply-chain/types'
import { SUPPLY_ORDER_STATUSES, SUPPLY_ORDER_STATUS_LABELS } from '@/lib/supply-chain/types'

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || res.statusText) }
  return res.json()
}

type AccountOption = { id: string; name: string }

const statusColors: Record<SupplyOrderStatus, string> = {
  pending: 'text-slate-400', confirmed: 'text-blue-400', in_production: 'text-cyan-400',
  shipped: 'text-indigo-400', delivered: 'text-emerald-400', cancelled: 'text-rose-400',
}

export default function SupplyOrdersClient({ workspaceId, initialOrders, accounts }: { workspaceId: string; initialOrders: SupplyOrder[]; accounts: AccountOption[] }) {
  const [orders, setOrders] = useState(initialOrders)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const [orderNumber, setOrderNumber] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [status, setStatus] = useState<SupplyOrderStatus>('pending')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')

  const supplierMap = new Map(accounts.map((a) => [a.id, a.name]))
  const resetForm = () => { setOrderNumber(''); setSupplierId(''); setStatus('pending'); setOrderDate(new Date().toISOString().slice(0, 10)); setExpectedDate(''); setNotes(''); setEditingId(null) }

  const openEdit = (o: SupplyOrder) => {
    setOrderNumber(o.order_number); setSupplierId(o.supplier_account_id || ''); setStatus(o.status)
    setOrderDate(o.order_date); setExpectedDate(o.expected_date || ''); setNotes(o.notes || '')
    setEditingId(o.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { workspace_id: workspaceId, order_number: orderNumber, supplier_account_id: supplierId || null, status, order_date: orderDate, expected_date: expectedDate || null, notes: notes || null }
    if (editingId) {
      const { supply_order } = await apiFetch<{ supply_order: SupplyOrder }>(`/api/supply-chain/orders/${editingId}?workspace_id=${workspaceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setOrders((prev) => prev.map((o) => o.id === editingId ? supply_order : o))
    } else {
      const { supply_order } = await apiFetch<{ supply_order: SupplyOrder }>('/api/supply-chain/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setOrders((prev) => [supply_order, ...prev])
    }
    resetForm(); setShowForm(false)
  }, [workspaceId, editingId, orderNumber, supplierId, status, orderDate, expectedDate, notes])

  const handleDelete = useCallback(async (id: string) => {
    await apiFetch(`/api/supply-chain/orders/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
    setOrders((prev) => prev.filter((o) => o.id !== id))
  }, [workspaceId])

  const filtered = orders.filter((o) => filterStatus === 'all' || o.status === filterStatus)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Supply Chain</p>
          <h1 className="mt-1 text-2xl font-semibold">Supply Orders</h1>
          <p className="mt-1 text-sm text-slate-400">{filtered.length} orders</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ New Order</button>
      </div>

      <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
        <option value="all">All statuses</option>
        {SUPPLY_ORDER_STATUSES.map((s) => <option key={s} value={s}>{SUPPLY_ORDER_STATUS_LABELS[s]}</option>)}
      </select>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Order' : 'New Supply Order'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs text-slate-400">Order # *</label><input required value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Supplier</label><select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">None</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Status</label><select value={status} onChange={(e) => setStatus(e.target.value as SupplyOrderStatus)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{SUPPLY_ORDER_STATUSES.map((s) => <option key={s} value={s}>{SUPPLY_ORDER_STATUS_LABELS[s]}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Order Date</label><input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Expected Date</label><input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            </div>
            <div><label className="mb-1 block text-xs text-slate-400">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white">{editingId ? 'Update' : 'Create'}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3">Order #</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Expected</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No supply orders found</td></tr> : filtered.map((o) => (
              <tr key={o.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium">{o.order_number}</td>
                <td className="px-4 py-3 text-slate-400">{o.supplier_account_id ? supplierMap.get(o.supplier_account_id) || '—' : '—'}</td>
                <td className="px-4 py-3 text-slate-400">{o.order_date}</td>
                <td className="px-4 py-3 text-slate-400">{o.expected_date || '—'}</td>
                <td className="px-4 py-3"><span className={`text-xs ${statusColors[o.status]}`}>{SUPPLY_ORDER_STATUS_LABELS[o.status]}</span></td>
                <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => openEdit(o)} className="text-xs text-slate-400 hover:text-white">Edit</button><button onClick={() => handleDelete(o.id)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
