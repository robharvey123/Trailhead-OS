'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { StaffProfile, Department, EmploymentType } from '@/lib/staffing/types'
import { DEPARTMENTS, DEPARTMENT_LABELS, EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS } from '@/lib/staffing/types'

export default function StaffClient({ workspaceId, initialStaff }: { workspaceId: string; initialStaff: StaffProfile[] }) {
  const [staff, setStaff] = useState(initialStaff)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterDept, setFilterDept] = useState<string>('all')
  const [search, setSearch] = useState('')

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [department, setDepartment] = useState<Department | ''>('')
  const [roleTitle, setRoleTitle] = useState('')
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time')
  const [hourlyRate, setHourlyRate] = useState('')
  const [capacityHours, setCapacityHours] = useState('40')
  const [startDate, setStartDate] = useState('')

  const resetForm = () => { setDisplayName(''); setEmail(''); setPhone(''); setDepartment(''); setRoleTitle(''); setEmploymentType('full_time'); setHourlyRate(''); setCapacityHours('40'); setStartDate(''); setEditingId(null) }

  const openEdit = (s: StaffProfile) => {
    setDisplayName(s.display_name); setEmail(s.email || ''); setPhone(s.phone || '')
    setDepartment(s.department || ''); setRoleTitle(s.role_title || '')
    setEmploymentType(s.employment_type); setHourlyRate(s.hourly_rate?.toString() || '')
    setCapacityHours(s.capacity_hours_per_week.toString()); setStartDate(s.start_date || '')
    setEditingId(s.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
    const payload = { workspace_id: workspaceId, display_name: displayName, email: email || null, phone: phone || null, department: department || null, role_title: roleTitle || null, employment_type: employmentType, hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null, capacity_hours_per_week: parseInt(capacityHours) || 40, start_date: startDate || null }
    if (editingId) {
      const { profile } = await apiFetch<{ profile: StaffProfile }>(`/api/staffing/profiles/${editingId}?workspace_id=${workspaceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setStaff((prev) => prev.map((s) => s.id === editingId ? profile : s))
    } else {
      const { profile } = await apiFetch<{ profile: StaffProfile }>('/api/staffing/profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setStaff((prev) => [profile, ...prev])
    }
    resetForm(); setShowForm(false)
    toast.success(editingId ? 'Staff updated' : 'Staff added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }, [workspaceId, editingId, displayName, email, phone, department, roleTitle, employmentType, hourlyRate, capacityHours, startDate])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/staffing/profiles/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
      setStaff((prev) => prev.filter((s) => s.id !== id))
      toast.success('Staff member removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }, [workspaceId])

  const filtered = staff.filter((s) => {
    if (filterDept !== 'all' && s.department !== filterDept) return false
    if (search) { const q = search.toLowerCase(); return s.display_name.toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q) || (s.role_title || '').toLowerCase().includes(q) }
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Team</p>
          <h1 className="mt-1 text-2xl font-semibold">Staff</h1>
          <p className="mt-1 text-sm text-slate-400">{filtered.length} team members</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ Add Member</button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 w-64" />
        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
          <option value="all">All departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Member' : 'Add Team Member'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs text-slate-400">Name *</label><input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Department</label><select value={department} onChange={(e) => setDepartment(e.target.value as Department)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">None</option>{DEPARTMENTS.map((d) => <option key={d} value={d}>{DEPARTMENT_LABELS[d]}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Role Title</label><input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Type</label><select value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Hourly Rate</label><input type="number" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Capacity (hrs/wk)</label><input type="number" value={capacityHours} onChange={(e) => setCapacityHours(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white">{editingId ? 'Update' : 'Add'}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? <p className="col-span-full text-center text-slate-500 py-8">No team members found</p> : filtered.map((s) => (
          <div key={s.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{s.display_name}</h3>
                <p className="text-xs text-slate-400">{s.role_title || 'No title'} {s.department ? `· ${DEPARTMENT_LABELS[s.department]}` : ''}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(s)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                <button onClick={() => handleDelete(s.id)} className="text-xs text-rose-400 hover:text-rose-300">×</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="rounded-full bg-slate-800 px-2 py-0.5">{EMPLOYMENT_TYPE_LABELS[s.employment_type]}</span>
              <span className="rounded-full bg-slate-800 px-2 py-0.5">{s.capacity_hours_per_week}h/wk</span>
              {s.hourly_rate != null && <span className="rounded-full bg-slate-800 px-2 py-0.5">${s.hourly_rate}/hr</span>}
            </div>
            {s.email && <p className="text-xs text-slate-500">{s.email}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
