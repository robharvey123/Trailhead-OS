'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { Product, ProductStatus } from '@/lib/products/types'
import { PRODUCT_STATUSES, PRODUCT_STATUS_LABELS } from '@/lib/products/types'

const statusColors: Record<ProductStatus, string> = {
  draft: 'text-slate-400', active: 'text-emerald-400', discontinued: 'text-amber-400', archived: 'text-slate-500',
}

export default function CatalogClient({ workspaceId, initialProducts }: { workspaceId: string; initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search, setSearch] = useState('')

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [status, setStatus] = useState<ProductStatus>('draft')
  const [barcode, setBarcode] = useState('')
  const [tags, setTags] = useState('')

  const resetForm = () => { setName(''); setSku(''); setBrand(''); setCategory(''); setDescription(''); setUnitCost(''); setUnitPrice(''); setStatus('draft'); setBarcode(''); setTags(''); setEditingId(null) }

  const openEdit = (p: Product) => {
    setName(p.name); setSku(p.sku); setBrand(p.brand || ''); setCategory(p.category || '')
    setDescription(p.description || ''); setUnitCost(p.unit_cost?.toString() || ''); setUnitPrice(p.unit_price?.toString() || '')
    setStatus(p.status); setBarcode(p.barcode || ''); setTags(p.tags?.join(', ') || '')
    setEditingId(p.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
    const payload = {
      workspace_id: workspaceId, name, sku, brand: brand || null, category: category || null,
      description: description || null, unit_cost: unitCost ? parseFloat(unitCost) : null,
      unit_price: unitPrice ? parseFloat(unitPrice) : null, status, barcode: barcode || null,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    }
    if (editingId) {
      const { product } = await apiFetch<{ product: Product }>(`/api/products/${editingId}?workspace_id=${workspaceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setProducts((prev) => prev.map((p) => p.id === editingId ? product : p))
    } else {
      const { product } = await apiFetch<{ product: Product }>('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setProducts((prev) => [product, ...prev])
    }
    resetForm(); setShowForm(false)
    toast.success(editingId ? 'Product updated' : 'Product created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }, [workspaceId, editingId, name, sku, brand, category, description, unitCost, unitPrice, status, barcode, tags])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/products/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
      setProducts((prev) => prev.filter((p) => p.id !== id))
      toast.success('Product deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }, [workspaceId])

  const filtered = products.filter((p) => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (search) { const q = search.toLowerCase(); return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q) }
    return true
  })

  const fmtCurrency = (v: number | null) => v != null ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Products</p>
          <h1 className="mt-1 text-2xl font-semibold">Catalog</h1>
          <p className="mt-1 text-sm text-slate-400">{filtered.length} products</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ New Product</button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 w-64" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
          <option value="all">All statuses</option>
          {PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{PRODUCT_STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Product' : 'New Product'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs text-slate-400">Name *</label><input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">SKU *</label><input required value={sku} onChange={(e) => setSku(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Brand</label><input value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Category</label><input value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Unit Cost</label><input type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Unit Price</label><input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Status</label><select value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{PRODUCT_STATUS_LABELS[s]}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Barcode</label><input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Tags (comma-separated)</label><input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            </div>
            <div><label className="mb-1 block text-xs text-slate-400">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
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
            <th className="px-4 py-3">Name</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Brand</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Cost</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Margin</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No products found</td></tr> : filtered.map((p) => {
              const margin = p.unit_cost != null && p.unit_price != null && p.unit_price > 0 ? ((p.unit_price - p.unit_cost) / p.unit_price * 100).toFixed(1) : null
              return (
                <tr key={p.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.sku}</td>
                  <td className="px-4 py-3 text-slate-400">{p.brand || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{p.category || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{fmtCurrency(p.unit_cost)}</td>
                  <td className="px-4 py-3 font-medium">{fmtCurrency(p.unit_price)}</td>
                  <td className="px-4 py-3 text-slate-400">{margin ? `${margin}%` : '—'}</td>
                  <td className="px-4 py-3"><span className={`text-xs ${statusColors[p.status]}`}>{PRODUCT_STATUS_LABELS[p.status]}</span></td>
                  <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => openEdit(p)} className="text-xs text-slate-400 hover:text-white">Edit</button><button onClick={() => handleDelete(p.id)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button></div></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
