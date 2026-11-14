"use client"

import { useState } from "react"

export default function InviteMemberForm({ workspaceId }: { workspaceId: string }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("viewer")
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/analytics/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, email, password, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to invite user.")
      setMessage("User invited and added to workspace.")
      setEmail("")
      setPassword("")
      setRole("viewer")
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to invite user.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--text)]">Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="os-input w-full px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text)]">Password</label>
        <input
          type="text"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="os-input w-full px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text)]">Role</label>
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className="os-select w-full px-3 py-2 text-sm"
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary"
      >
        {loading ? "Adding..." : "Add User"}
      </button>
      {message && <p className="mt-2 text-sm text-[var(--text-2)]">{message}</p>}
    </form>
  )
}
