'use client'

import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { Notification } from '@/lib/comms/types'
import { NOTIFICATION_TYPE_LABELS } from '@/lib/comms/types'

export default function NotificationsClient({ workspaceId, initialNotifications }: { workspaceId: string; initialNotifications: Notification[] }) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications])

  const markRead = useCallback(async (id: string) => {
    try {
      await apiFetch('/api/comms/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspaceId, id, is_read: true }) })
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark as read')
    }
  }, [workspaceId])

  const markAllRead = useCallback(async () => {
    try {
      await apiFetch('/api/comms/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspaceId, mark_all_read: true }) })
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      toast.success('All marked as read')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    }
  }, [workspaceId])

  const filtered = showUnreadOnly ? notifications.filter((n) => !n.is_read) : notifications

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Comms</p>
          <h1 className="mt-1 text-2xl font-semibold">Notifications</h1>
          <p className="mt-1 text-sm text-slate-400">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && <button onClick={markAllRead} className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs uppercase text-slate-300 hover:text-white">Mark all read</button>}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-400"><input type="checkbox" checked={showUnreadOnly} onChange={(e) => setShowUnreadOnly(e.target.checked)} className="rounded" />Unread only</label>

      <div className="space-y-2">
        {filtered.length === 0 ? <p className="text-center text-slate-500 py-8">No notifications</p> : filtered.map((n) => (
          <div key={n.id} className={`flex items-start gap-3 rounded-xl border p-4 transition ${n.is_read ? 'border-slate-800/50 bg-slate-900/30' : 'border-slate-700 bg-slate-900/80'}`}>
            {!n.is_read && <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{NOTIFICATION_TYPE_LABELS[n.type]}</span>
                <span className="text-[10px] text-slate-600">{n.created_at ? new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
              </div>
              <p className="text-sm font-medium">{n.title}</p>
              {n.body && <p className="text-xs text-slate-400 mt-0.5">{n.body}</p>}
            </div>
            {!n.is_read && <button onClick={() => markRead(n.id)} className="shrink-0 text-xs text-slate-400 hover:text-white">Mark read</button>}
          </div>
        ))}
      </div>
    </div>
  )
}
