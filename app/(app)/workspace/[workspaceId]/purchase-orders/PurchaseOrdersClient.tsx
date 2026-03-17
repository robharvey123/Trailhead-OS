'use client'

import { useCallback, useMemo, useState } from 'react'
import type { FinancePurchaseOrder, POStatus, POLineItem } from '@/lib/finance/types'
import { PO_STATUSES, PO_STATUS_LABELS } from '@/lib/finance/types'

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || res.statusText) }
  return res.json()
}

type AccountOption = { id: string; name: string }

const statusColors: Record<POStatus, string> = {
  draft: 'text-slate-400', submitted: 'text-blue-400', approved: 'text-cyan-400',
  ordered: 'text-indigo-400', partial_received: 'text-amber-400', received: 'text-emerald-400', cancelled: 'text-rose-400',
}

export default function PurchaseOrdersClient({ workspaceId, initialPOs, accounts }: { workspaceId: string; initialPOs: FinancePurchaseOrder[]; accounts: AccountOption[] }) {
  const [pos, setPOs] = useState(initialPOs)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const [poNumber, setPONumber] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [status, setStatus] = useState<POStatus>('draft')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [expectedDate, setExpectedDate] = useState('')
  const [shippingCost, setShippingCost] = useState('0')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<POLineItem[]>([])

  const vendorMap = new Map(accounts.map((a) => [a.id, a.name]))

  const resetForm = () => { setPONumber(''); setVendorId(''); setStatus('draft'); setOrderDate(new Date().toISOString().slice(0, 10)); setExpectedDate(''); setShippingCost('0'); setNotes(''); setLineItems([]); setEditingId(null) }

  const addLineItem = () => setLineItems((prev) => [...prev, { id: crypto.randomUUID(), description: '', quantity: 1, unit_cost: 0, total: 0 }])
  const removeLineItem = (id: string) => setLineItems((prev) => prev.filter((i) => i.id !== id))
  const updateLineItem = (id: string, field: string, value: string | number) => {
    setLineItems((prev) => prev.map((item) => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: value }
      updated.total = updated.quantity * updated.unit_cost
      return updated
    }))
  }

  const openEdit = (po: FinancePurchaseOrder) => {
    setPONumber(po.po_number); setVendorId(po.vendor_account_id || ''); setStatus(po.status)
    setOrderDate(po.order_date); setExpectedDate(po.expected_delivery_date || '')
    setShippingCost(po.shipping_cost.toString()); setNotes(po.notes || '')
    setLineItems(po.line_items || []); setEditingId(po.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unit_cost, 0)
    const total = subtotal + (parseFloat(shippingCost) || 0)
    const payload = {
      workspace_id: workspaceId, po_number: poNumber, vendor_account_id: vendorId || null,
      status, order_date: orderDate, expected_delivery_date: expectedDate || null,
      shipping_cost: parseFloat(shippingCost) || 0, notes: notes || null, line_items: lineItems,
      subtotal, total,
    }
    if (editingId) {
      const { purchase_order } = await apiFetch<{ purchase_order: FinancePurchaseOrder }>(`/api/finance/purchase-orders/${editingId}?workspace_id=${workspaceId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      setPOs((prev) => prev.map((p) => p.id === editingId ? purchase_order : p))
    } else {
      const { purchase_order } = await apiFetch<{ purchase_order: FinancePurchaseOrder }>('/api/finance/purchase-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      setPOs((prev) => [purchase_order, ...prev])
    }
    resetForm(); setShowForm(false)
  }, [workspaceId, editingId, poNumber, vendorId, status, orderDate, expectedDate, shippingCost, notes, lineItems])

  const handleDelete = useCallback(async (id: string) => {
    await apiFetch(`/api/finance/purchase-orders/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
    setPOs((prev) => prev.filter((p) => p.id !== id))
  }, [workspaceId])

  const filtered = pos.filter((p) => filterStatus === 'all' || p.status === filterStatus)
  const totalValue = useMemo(() => filtered.reduce((s, p) => s + p.total, 0), [filtered])
  const fmtCurrency = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Finance</p>
          <h1 className="mt-1 text-2xl font-semibold">Purchase Orders</h1>
          <p className="mt-1 text-sm text-slate-400">{filtered.length} orders &middot; Total: {fmtCurrency(totalValue)}</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ New PO</button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
          <option value="all">All statuses</option>
          {PO_STATUSES.map((s) => <option key={s} value={s}>{PO_STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit PO' : 'New Purchase Order'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs text-slate-400">PO # *</label><input required value={poNumber} onChange={(e) => setPONumber(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Vendor</label><select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">None</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Status</label><select value={status} onChange={(e) => setStatus(e.target.value as POStatus)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{PO_STATUSES.map((s) => <option key={s} value={s}>{PO_STATUS_LABELS[s]}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Order Date</label><input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Expected Delivery</label><input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Shipping Cost</label><input type="number" step="0.01" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-400">Line Items</label>
                <button type="button" onClick={addLineItem} className="text-xs text-blue-400 hover:text-blue-300">+ Add item</button>
              </div>
              {lineItems.map((item) => (
                <div key={item.id} className="mb-2 grid grid-cols-12 gap-2 items-center">
                  <input placeholder="Description" value={item.description} onChange={(e) => updateLineItem(item.id, 'description', e.target.value)} className="col-span-4 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                  <input placeholder="SKU" value={item.sku || ''} onChange={(e) => updateLineItem(item.id, 'sku', e.target.value)} className="col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} className="col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                  <input type="number" step="0.01" placeholder="Cost" value={item.unit_cost} onChange={(e) => updateLineItem(item.id, 'unit_cost', parseFloat(e.target.value) || 0)} className="col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                  <span className="col-span-1 text-right text-sm text-slate-300">{fmtCurrency(item.quantity * item.unit_cost)}</span>
                  <button type="button" onClick={() => removeLineItem(item.id)} className="col-span-1 text-xs text-rose-400 hover:text-rose-300">×</button>
                </div>
              ))}
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
            <th className="px-4 py-3">PO #</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Expected</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No purchase orders found</td></tr> : filtered.map((po) => (
              <tr key={po.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium">{po.po_number}</td>
                <td className="px-4 py-3 text-slate-400">{po.vendor_account_id ? vendorMap.get(po.vendor_account_id) || '—' : '—'}</td>
                <td className="px-4 py-3 text-slate-400">{po.order_date}</td>
                <td className="px-4 py-3 text-slate-400">{po.expected_delivery_date || '—'}</td>
                <td className="px-4 py-3 text-slate-400">{po.line_items?.length || 0}</td>
                <td className="px-4 py-3 font-medium">{fmtCurrency(po.total)}</td>
                <td className="px-4 py-3"><span className={`text-xs ${statusColors[po.status]}`}>{PO_STATUS_LABELS[po.status]}</span></td>
                <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => openEdit(po)} className="text-xs text-slate-400 hover:text-white">Edit</button><button onClick={() => handleDelete(po.id)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
