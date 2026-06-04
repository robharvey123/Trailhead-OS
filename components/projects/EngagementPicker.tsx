'use client'

export type EngagementOption = { id: string; name: string; status?: string }

/** Reusable engagement selector — used on the create form and the change dialog. */
export default function EngagementPicker({
  engagements,
  value,
  onChange,
  disabled,
  includeNone = false,
}: {
  engagements: EngagementOption[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
  includeNone?: boolean
}) {
  return (
    <select
      className="w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{includeNone ? '— none' : '— select an engagement'}</option>
      {engagements.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
          {e.status && e.status !== 'Active' ? ` (${e.status})` : ''}
        </option>
      ))}
    </select>
  )
}
