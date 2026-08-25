'use client'

import { useOptimistic, useTransition } from 'react'
import { toggleWorksheetItemAction } from '@/app/(os)/growth/actions'

export default function WorksheetChecklist({
  siteId,
  encodedUrl,
  items,
  checked,
}: {
  siteId: string
  encodedUrl: string
  items: Array<{ key: string; label: string; group: string }>
  checked: Record<string, boolean>
}) {
  const [optimistic, setOptimistic] = useOptimistic(checked, (state, next: { key: string; value: boolean }) => ({
    ...state,
    [next.key]: next.value,
  }))
  const [, startTransition] = useTransition()
  const groups = [...new Set(items.map((i) => i.group))]

  return (
    <div className="mt-4 space-y-5">
      {groups.map((group) => (
        <div key={group}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-3)]">{group}</p>
          <ul className="mt-2 space-y-1.5">
            {items
              .filter((i) => i.group === group)
              .map((item) => (
                <li key={item.key}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm text-[color:var(--text)] transition hover:border-[color:var(--accent)]">
                    <input
                      type="checkbox"
                      checked={Boolean(optimistic[item.key])}
                      onChange={(e) => {
                        const value = e.target.checked
                        startTransition(async () => {
                          setOptimistic({ key: item.key, value })
                          await toggleWorksheetItemAction(siteId, encodedUrl, item.key, value)
                        })
                      }}
                      className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                    />
                    <span className={optimistic[item.key] ? 'text-[color:var(--text-3)] line-through' : ''}>{item.label}</span>
                  </label>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
