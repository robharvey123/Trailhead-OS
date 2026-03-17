'use client'

import { useCallback, useState } from 'react'
import type { Shipment, ShipmentStatus } from '@/lib/supply-chain/types'
import { SHIPMENT_STATUSES, SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLORS } from '@/lib/supply-chain/types'

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || res.statusText) }
  return res.json()
}

export default function ShipmentsClient({ workspaceId, initialShipments }: { workspaceId: string; initialShipments: Shipment[] }) {
  const [shipments, setShipments] = useState(initialShipments)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const [referenceNumber, setReferenceNumber] = useState('')
  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [status, setStatus] = useState<ShipmentStatus>('pending')
  const [shipDate, setShipDate] = useState('')
  const [estimatedDelivery, setEstimatedDelivery] = useState('')
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [notes, setNotes] = useState('')

  const resetForm = () => { setReferenceNumber(''); setCarrier(''); setTrackingNumber(''); setStatus('pending'); setShipDate(''); setEstimatedDelivery(''); setOrigin(''); setDestination(''); setNotes(''); setEditingId(null) }

  const openEdit = (s: Shipment) => {
    setReferenceNumber(s.reference_number || ''); setCarrier(s.carrier || ''); setTrackingNumber(s.tracking_number || '')
    setStatus(s.status); setShipDate(s.ship_date || ''); setEstimatedDelivery(s.estimated_delivery || '')
    setOrigin(s.origin_address || ''); setDestination(s.destination_address || ''); setNotes(s.notes || '')
    setEditingId(s.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { workspace_id: workspaceId, reference_number: referenceNumber || null, carrier: carrier || null, tracking_number: trackingNumber || null, status, ship_date: shipDate || null, estimated_delivery: estimatedDelivery || null, origin_address: origin || null, destination_address: destination || null, notes: notes || null }
    if (editingId) {
      const { shipment } = await apiFetch<{ shipment: Shipment }>(`/api/supply-chain/shipments/${editingId}?workspace_id=${workspaceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setShipments((prev) => prev.map((s) => s.id === editingId ? shipment : s))
    } else {
      const { shipment } = await apiFetch<{ shipment: Shipment }>('/api/supply-chain/shipments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setShipments((prev) => [shipment, ...prev])
    }
    resetForm(); setShowForm(false)
  }, [workspaceId, editingId, referenceNumber, carrier, trackingNumber, status, shipDate, estimatedDelivery, origin, destination, notes])

  const handleDelete = useCallback(async (id: string) => {
    await apiFetch(`/api/supply-chain/shipments/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
    setShipments((prev) => prev.filter((s) => s.id !== id))
  }, [workspaceId])

  const filtered = shipments.filter((s) => filterStatus === 'all' || s.status === filterStatus)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Supply Chain</p>
          <h1 className="mt-1 text-2xl font-semibold">Shipments</h1>
          <p className="mt-1 text-sm text-slate-400">{filtered.length} shipments</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ New Shipment</button>
      </div>

      <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
        <option value="all">All statuses</option>
        {SHIPMENT_STATUSES.map((s) => <option key={s} value={s}>{SHIPMENT_STATUS_LABELS[s]}</option>)}
      </select>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Shipment' : 'New Shipment'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs text-slate-400">Reference #</label><input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Carrier</label><input value={carrier} onChange={(e) => setCarrier(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Tracking #</label><input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Status</label><select value={status} onChange={(e) => setStatus(e.target.value as ShipmentStatus)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{SHIPMENT_STATUSES.map((s) => <option key={s} value={s}>{SHIPMENT_STATUS_LABELS[s]}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Ship Date</label><input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Est. Delivery</label><input type="date" value={estimatedDelivery} onChange={(e) => setEstimatedDelivery(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div className="sm:col-span-3 grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-xs text-slate-400">Origin Address</label><input value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
                <div><label className="mb-1 block text-xs text-slate-400">Destination Address</label><input value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              </div>
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
            <th className="px-4 py-3">Ref #</th><th className="px-4 py-3">Carrier</th><th className="px-4 py-3">Tracking</th><th className="px-4 py-3">Ship Date</th><th className="px-4 py-3">Est. Delivery</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No shipments found</td></tr> : filtered.map((s) => (
              <tr key={s.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium">{s.reference_number || '—'}</td>
                <td className="px-4 py-3 text-slate-400">{s.carrier || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{s.tracking_number || '—'}</td>
                <td className="px-4 py-3 text-slate-400">{s.ship_date || '—'}</td>
                <td className="px-4 py-3 text-slate-400">{s.estimated_delivery || '—'}</td>
                <td className="px-4 py-3"><span className={`text-xs ${SHIPMENT_STATUS_COLORS[s.status]}`}>{SHIPMENT_STATUS_LABELS[s.status]}</span></td>
                <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => openEdit(s)} className="text-xs text-slate-400 hover:text-white">Edit</button><button onClick={() => handleDelete(s.id)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
