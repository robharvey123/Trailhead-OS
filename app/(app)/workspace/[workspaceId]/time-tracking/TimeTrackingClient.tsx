'use client'

import { useCallback, useMemo, useState } from 'react'
import type { StaffTimeEntry } from '@/lib/staffing/types'

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || res.statusText) }
  return res.json()
}

type StaffOption = { id: string; display_name: string }

export default function TimeTrackingClient({ workspaceId, initialEntries, staffList }: { workspaceId: string; initialEntries: StaffTimeEntry[]; staffList: StaffOption[] }) {
  const [entries, setEntries] = useState(initialEntries)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStaff, setFilterStaff] = useState<string>('all')

  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState('')
  const [description, setDescription] = useState('')
  const [billable, setBillable] = useState(true)

  const resetForm = () => { setStaffId(''); setDate(new Date().toISOString().slice(0, 10)); setHours(''); setDescription(''); setBillable(true); setEditingId(null) }

  const openEdit = (e: StaffTimeEntry) => {
    setStaffId(e.staff_profile_id); setDate(e.date); setHours(e.hours.toString())
    setDescription(e.description || ''); setBillable(e.billable); setEditingId(e.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { workspace_id: workspaceId, staff_profile_id: staffId, date, hours: parseFloat(hours) || 0, description: description || null, billable }
    if (editingId) {
      const { time_entry } = await apiFetch<{ time_entry: StaffTimeEntry }>(`/api/staffing/time-entries/${editingId}?workspace_id=${workspaceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const staff = staffList.find((s) => s.id === time_entry.staff_profile_id)
      setEntries((prev) => prev.map((en) => en.id === editingId ? { ...time_entry, staff_name: staff?.display_name } : en))
    } else {
      const { time_entry } = await apiFetch<{ time_entry: StaffTimeEntry }>('/api/staffing/time-entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const staff = staffList.find((s) => s.id === time_entry.staff_profile_id)
      setEntries((prev) => [{ ...time_entry, staff_name: staff?.display_name }, ...prev])
    }
    resetForm(); setShowForm(false)
  }, [workspaceId, editingId, staffId, date, hours, description, billable, staffList])

  const handleDelete = useCallback(async (id: string) => {
    await apiFetch(`/api/staffing/time-entries/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [workspaceId])

  const filtered = entries.filter((e) => filterStaff === 'all' || e.staff_profile_id === filterStaff)
  const totalHours = useMemo(() => filtered.reduce((s, e) => s + e.hours, 0), [filtered])
  const billableHours = useMemo(() => filtered.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0), [filtered])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Team</p>
          <h1 className="mt-1 text-2xl font-semibold">Time Tracking</h1>
          <p className="mt-1 text-sm text-slate-400">{totalHours.toFixed(1)}h total &middot; {billableHours.toFixed(1)}h billable</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ Log Time</button>
      </div>

      <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
        <option value="all">All staff</option>
        {staffList.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
      </select>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Entry' : 'Log Time'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs text-slate-400">Staff *</label><select required value={staffId} onChange={(e) => setStaffId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">Select…</option>{staffList.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Hours *</label><input type="number" step="0.25" required value={hours} onChange={(e) => setHours(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="mb-1 block text-xs text-slate-400">Description</label><input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div className="flex items-end"><label className="flex items-center gap-2 text-sm text-slate-300 pb-2"><input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="rounded" />Billable</label></div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white">{editingId ? 'Update' : 'Log'}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3">Date</th><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Task</th><th className="px-4 py-3 text-right">Hours</th><th className="px-4 py-3">Billable</th><th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No time entries found</td></tr> : filtered.map((e) => (
              <tr key={e.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-slate-400">{e.date}</td>
                <td className="px-4 py-3 font-medium">{e.staff_name || '—'}</td>
                <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">{e.description || '—'}</td>
                <td className="px-4 py-3 text-slate-400">{e.task_title || '—'}</td>
                <td className="px-4 py-3 text-right font-medium">{e.hours}h</td>
                <td className="px-4 py-3">{e.billable ? <span className="text-xs text-emerald-400">Yes</span> : <span className="text-xs text-slate-500">No</span>}</td>
                <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => openEdit(e)} className="text-xs text-slate-400 hover:text-white">Edit</button><button onClick={() => handleDelete(e.id)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
