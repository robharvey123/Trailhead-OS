'use client'

import { useCallback, useState } from 'react'
import type { StaffSchedule, ScheduleType } from '@/lib/staffing/types'
import { SCHEDULE_TYPES, SCHEDULE_TYPE_LABELS, SCHEDULE_TYPE_COLORS } from '@/lib/staffing/types'

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || res.statusText) }
  return res.json()
}

type StaffOption = { id: string; display_name: string }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ScheduleClient({ workspaceId, initialSchedules, staffList, weekStart }: { workspaceId: string; initialSchedules: StaffSchedule[]; staffList: StaffOption[]; weekStart: string }) {
  const [schedules, setSchedules] = useState(initialSchedules)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [type, setType] = useState<ScheduleType>('work')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')

  const resetForm = () => { setStaffId(''); setDate(''); setStartTime('09:00'); setEndTime('17:00'); setType('work'); setTitle(''); setNotes(''); setEditingId(null) }

  const openEdit = (s: StaffSchedule) => {
    setStaffId(s.staff_profile_id); setDate(s.date); setStartTime(s.start_time); setEndTime(s.end_time)
    setType(s.type); setTitle(s.title || ''); setNotes(s.notes || ''); setEditingId(s.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { workspace_id: workspaceId, staff_profile_id: staffId, date, start_time: startTime, end_time: endTime, type, title: title || null, notes: notes || null }
    if (editingId) {
      const { schedule } = await apiFetch<{ schedule: StaffSchedule }>(`/api/staffing/schedules/${editingId}?workspace_id=${workspaceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const staff = staffList.find((s) => s.id === schedule.staff_profile_id)
      setSchedules((prev) => prev.map((s) => s.id === editingId ? { ...schedule, staff_name: staff?.display_name } : s))
    } else {
      const { schedule } = await apiFetch<{ schedule: StaffSchedule }>('/api/staffing/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const staff = staffList.find((s) => s.id === schedule.staff_profile_id)
      setSchedules((prev) => [...prev, { ...schedule, staff_name: staff?.display_name }].sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`)))
    }
    resetForm(); setShowForm(false)
  }, [workspaceId, editingId, staffId, date, startTime, endTime, type, title, notes, staffList])

  const handleDelete = useCallback(async (id: string) => {
    await apiFetch(`/api/staffing/schedules/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
    setSchedules((prev) => prev.filter((s) => s.id !== id))
  }, [workspaceId])

  // Build week dates
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Team</p>
          <h1 className="mt-1 text-2xl font-semibold">Schedule</h1>
          <p className="mt-1 text-sm text-slate-400">Week of {weekStart}</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ Add Entry</button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Entry' : 'New Schedule Entry'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs text-slate-400">Staff *</label><select required value={staffId} onChange={(e) => setStaffId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">Select…</option>{staffList.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Date *</label><input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Type</label><select value={type} onChange={(e) => setType(e.target.value as ScheduleType)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{SCHEDULE_TYPES.map((t) => <option key={t} value={t}>{SCHEDULE_TYPE_LABELS[t]}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Start</label><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">End</label><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white">{editingId ? 'Update' : 'Add'}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <div className="grid grid-cols-7 min-w-[700px]">
          {weekDates.map((d, i) => {
            const daySchedules = schedules.filter((s) => s.date === d)
            return (
              <div key={d} className={`border-r border-slate-800 last:border-r-0 ${i === 0 || i === 6 ? 'bg-slate-950/50' : 'bg-slate-900/30'}`}>
                <div className="border-b border-slate-800 px-3 py-2 text-center">
                  <p className="text-xs font-semibold uppercase text-slate-400">{DAYS[i]}</p>
                  <p className="text-sm">{d.slice(8)}</p>
                </div>
                <div className="min-h-[200px] space-y-1 p-2">
                  {daySchedules.map((s) => (
                    <button key={s.id} onClick={() => openEdit(s)} className={`w-full rounded-lg px-2 py-1.5 text-left text-xs transition hover:opacity-80 ${SCHEDULE_TYPE_COLORS[s.type]}`}>
                      <p className="font-medium">{s.staff_name}</p>
                      <p className="opacity-70">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</p>
                      {s.title && <p className="opacity-70 truncate">{s.title}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
