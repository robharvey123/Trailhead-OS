'use client'

import { useCallback, useMemo, useState } from 'react'
import type { InventoryRow } from '@/lib/supply-chain/types'

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || res.statusText) }
  return res.json()
}

type ProductOption = { id: string; name: string; sku: string }

export default function InventoryClient({ workspaceId, initialInventory, products }: { workspaceId: string; initialInventory: InventoryRow[]; products: ProductOption[] }) {
  const [items, setItems] = useState(initialInventory)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [alertOnly, setAlertOnly] = useState(false)

  const [productId, setProductId] = useState('')
  const [warehouse, setWarehouse] = useState('')
  const [qtyOnHand, setQtyOnHand] = useState('0')
  const [qtyReserved, setQtyReserved] = useState('0')
  const [reorderPoint, setReorderPoint] = useState('0')
  const [reorderQty, setReorderQty] = useState('0')
  const [unitCost, setUnitCost] = useState('')

  const resetForm = () => { setProductId(''); setWarehouse(''); setQtyOnHand('0'); setQtyReserved('0'); setReorderPoint('0'); setReorderQty('0'); setUnitCost(''); setEditingId(null) }

  const openEdit = (r: InventoryRow) => {
    setProductId(r.product_id || ''); setWarehouse(r.warehouse); setQtyOnHand(r.qty_on_hand.toString())
    setQtyReserved(r.qty_reserved.toString()); setReorderPoint(r.reorder_point.toString())
    setReorderQty(r.reorder_qty.toString()); setUnitCost(r.unit_cost?.toString() || '')
    setEditingId(r.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { workspace_id: workspaceId, product_id: productId || null, warehouse: warehouse || 'default', qty_on_hand: parseInt(qtyOnHand) || 0, qty_reserved: parseInt(qtyReserved) || 0, reorder_point: parseInt(reorderPoint) || 0, reorder_qty: parseInt(reorderQty) || 0, unit_cost: unitCost ? parseFloat(unitCost) : null }
    if (editingId) {
      const { item } = await apiFetch<{ item: InventoryRow }>(`/api/supply-chain/inventory/${editingId}?workspace_id=${workspaceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const prod = products.find((p) => p.id === item.product_id)
      setItems((prev) => prev.map((i) => i.id === editingId ? { ...item, product_name: prod?.name, product_sku: prod?.sku } : i))
    } else {
      const { item } = await apiFetch<{ item: InventoryRow }>('/api/supply-chain/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const prod = products.find((p) => p.id === item.product_id)
      setItems((prev) => [{ ...item, product_name: prod?.name, product_sku: prod?.sku }, ...prev])
    }
    resetForm(); setShowForm(false)
  }, [workspaceId, editingId, productId, warehouse, qtyOnHand, qtyReserved, reorderPoint, reorderQty, unitCost, products])

  const handleDelete = useCallback(async (id: string) => {
    await apiFetch(`/api/supply-chain/inventory/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [workspaceId])

  const filtered = items.filter((i) => {
    if (alertOnly && i.qty_on_hand > i.reorder_point) return false
    if (search) { const q = search.toLowerCase(); return (i.product_name || '').toLowerCase().includes(q) || (i.product_sku || '').toLowerCase().includes(q) || i.warehouse.toLowerCase().includes(q) }
    return true
  })

  const totals = useMemo(() => ({ onHand: filtered.reduce((s, i) => s + i.qty_on_hand, 0), lowStock: filtered.filter((i) => i.qty_on_hand <= i.reorder_point).length }), [filtered])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Supply Chain</p>
          <h1 className="mt-1 text-2xl font-semibold">Inventory</h1>
          <p className="mt-1 text-sm text-slate-400">{filtered.length} items &middot; {totals.onHand.toLocaleString()} units on hand{totals.lowStock > 0 && <span className="text-amber-400"> &middot; {totals.lowStock} low stock</span>}</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ Add Stock</button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 w-64" />
        <label className="flex items-center gap-2 text-sm text-slate-400"><input type="checkbox" checked={alertOnly} onChange={(e) => setAlertOnly(e.target.checked)} className="rounded" />Low stock only</label>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Inventory' : 'Add Inventory'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs text-slate-400">Product</label><select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">None</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Warehouse *</label><input required value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Qty On Hand</label><input type="number" value={qtyOnHand} onChange={(e) => setQtyOnHand(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Qty Reserved</label><input type="number" value={qtyReserved} onChange={(e) => setQtyReserved(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Reorder Point</label><input type="number" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Unit Cost</label><input type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white">{editingId ? 'Update' : 'Add'}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3">Product</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Warehouse</th><th className="px-4 py-3 text-right">On Hand</th><th className="px-4 py-3 text-right">Reserved</th><th className="px-4 py-3 text-right">Available</th><th className="px-4 py-3 text-right">Reorder Pt</th><th className="px-4 py-3">Alert</th><th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No inventory items found</td></tr> : filtered.map((r) => {
              const avail = r.qty_on_hand - r.qty_reserved
              const low = r.qty_on_hand <= r.reorder_point
              return (
                <tr key={r.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium">{r.product_name || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{r.product_sku || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{r.warehouse}</td>
                  <td className="px-4 py-3 text-right">{r.qty_on_hand.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{r.qty_reserved.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium">{avail.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{r.reorder_point.toLocaleString()}</td>
                  <td className="px-4 py-3">{low ? <span className="text-xs text-amber-400">Low Stock</span> : <span className="text-xs text-emerald-400">OK</span>}</td>
                  <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => openEdit(r)} className="text-xs text-slate-400 hover:text-white">Edit</button><button onClick={() => handleDelete(r.id)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button></div></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
