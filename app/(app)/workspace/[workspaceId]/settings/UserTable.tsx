"use client"

import { useEffect, useState } from "react"

export default function UserTable({ workspaceId }: { workspaceId: string }) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/workspace/users?workspaceId=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => {
        setUsers(data.users || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [workspaceId])

  const handleChangePassword = async (userId: string) => {
    setMessage(null)
    const res = await fetch(`/api/workspace/users`, {
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
      <h2 className="text-lg font-semibold mb-4">Workspace Users</h2>
      {loading ? (
        <p>Loading users...</p>
      ) : (
        <table className="w-full text-sm border border-slate-800 rounded-lg">
          <thead>
            <tr className="bg-slate-900">
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Role</th>
              <th className="p-2 text-left">Change Password</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-800">
                <td className="p-2">{user.email}</td>
                <td className="p-2">{user.role}</td>
                <td className="p-2">
                  {editId === user.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="New password"
                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleChangePassword(user.id)}
                        className="rounded bg-blue-600 px-2 py-1 text-white text-xs"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className="rounded bg-slate-700 px-2 py-1 text-white text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditId(user.id)}
                      className="rounded bg-slate-700 px-2 py-1 text-white text-xs"
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
      {message && <p className="mt-2 text-sm">{message}</p>}
    </div>
  )
}
