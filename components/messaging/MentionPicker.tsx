'use client'

export type MentionCandidate = { id: string; full_name: string }

/**
 * Autocomplete dropdown for @mentions. Presentational only — the composer owns
 * the query, filtering, and keyboard navigation; this renders the candidate list
 * and reports clicks/hovers. Anchored above the composer input.
 */
export default function MentionPicker({
  items,
  activeIndex,
  onSelect,
  onHover,
}: {
  items: MentionCandidate[]
  activeIndex: number
  onSelect: (person: MentionCandidate) => void
  onHover: (index: number) => void
}) {
  if (items.length === 0) return null

  return (
    <div
      role="listbox"
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 4px)',
        left: 12,
        right: 12,
        maxHeight: 200,
        overflowY: 'auto',
        zIndex: 40,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 4,
        boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
      }}
    >
      {items.map((person, index) => (
        <button
          key={person.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          // onMouseDown (not onClick) so the textarea doesn't blur before select.
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(person)
          }}
          onMouseEnter={() => onHover(index)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 13,
            color: 'var(--text)',
            background: index === activeIndex ? 'var(--surface-2)' : 'transparent',
          }}
        >
          <span style={{ fontWeight: 600 }}>@{person.full_name}</span>
        </button>
      ))}
    </div>
  )
}
