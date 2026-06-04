'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTask } from '@/app/(os)/my-work/actions'

/** Click-to-edit title; saves on blur / Enter, reverts on Escape. */
export default function TaskTitleEditor({ taskId, title }: { taskId: string; title: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)
  const [pending, startTransition] = useTransition()

  function save() {
    const next = value.trim()
    setEditing(false)
    if (!next || next === title) { setValue(title); return }
    startTransition(async () => {
      const res = await updateTask(taskId, { title: next })
      if (res.error) setValue(title)
      else router.refresh()
    })
  }

  if (!editing) {
    return (
      <span className="topbar-title" style={{ cursor: 'text' }} title="Click to rename" onClick={() => { setValue(title); setEditing(true) }}>
        {title}
      </span>
    )
  }
  return (
    <input
      autoFocus
      className="topbar-title"
      style={{ border: '1px solid var(--border)', borderRadius: 5, padding: '2px 6px', background: 'var(--surface-2)' }}
      value={value}
      disabled={pending}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') { setValue(title); setEditing(false) } }}
    />
  )
}
