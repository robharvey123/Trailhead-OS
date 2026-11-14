"use client"

import { useEffect, useState } from "react"

type WorkspaceUser = {
  id: string
  email: string
  role: string
  lastSignIn: string | null
}

export default function UserTable({ workspaceId }: { workspaceId: string }) {
  const [users, setUsers] = useState<WorkspaceUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(`/api/analytics/users?workspaceId=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) {
          return
        }
        setUsers(data.users || [])
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [workspaceId])

  const handleChangePassword = async (userId: string) => {
    setMessage(null)
    const res = await fetch(`/api/analytics/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, password: newPassword }),
    })
    const data = await res.json()
    if (!res.ok) setMessage(data.error || "Failed to change password.")
    else setMessage("Password updated.")
    setEditId(null)
    setNewPassword("")
  }

  return (
    <div className="mt-8">
      <h2 className="mb-4 text-lg font-semibold text-[var(--text)]">Workspace Users</h2>
      {loading ? (
        <p className="text-sm text-[var(--text-3)]">Loading users...</p>
      ) : (
        <table className="w-full rounded-control border border-[var(--border)] text-sm text-[var(--text)]">
          <thead>
            <tr className="bg-[var(--surface)]">
              <th className="os-label p-2 text-left">Email</th>
              <th className="os-label p-2 text-left">Role</th>
              <th className="os-label p-2 text-left">Last Login</th>
              <th className="os-label p-2 text-left">Change Password</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-[var(--border)]">
                <td className="p-2">{user.email}</td>
                <td className="p-2">{user.role}</td>
                <td className="p-2">
                  {user.lastSignIn
                    ? new Date(user.lastSignIn).toLocaleString()
                    : 'Never'}
                </td>
                <td className="p-2">
                  {editId === user.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="New password"
                        className="os-input px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => handleChangePassword(user.id)}
                        className="btn btn-primary btn-sm"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className="btn btn-ghost btn-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditId(user.id)}
                      className="btn btn-ghost btn-sm"
                    >
                      Change
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {message && <p className="mt-2 text-sm text-[var(--text-2)]">{message}</p>}
    </div>
  )
}
