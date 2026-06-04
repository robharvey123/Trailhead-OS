'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateTask } from '@/app/(os)/my-work/actions'

/** Editable description: a textarea with an explicit Save (shown when changed). */
export default function TaskDescriptionEditor({ taskId, description }: { taskId: string; description: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(description ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const dirty = value !== (description ?? '')

  function save() {
    if (!dirty) return
    setError('')
    startTransition(async () => {
      const res = await updateTask(taskId, { description: value })
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <textarea
        className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] min-h-[4rem] resize-y"
        value={value}
        disabled={pending}
        placeholder="Add a description…"
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
        {error ? <span style={{ color: 'var(--red)', fontSize: 12 }}>{error}</span> : null}
        {dirty ? <button className="btn btn-primary btn-sm" onClick={save} disabled={pending}>{pending ? 'Saving…' : 'Save'}</button> : null}
      </div>
    </div>
  )
}
