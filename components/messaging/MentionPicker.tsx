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
      aria-label="Mention suggestions"
      className="absolute bottom-[calc(100%+4px)] left-3 right-3 z-40 max-h-[200px] overflow-y-auto rounded-control border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-lg)]"
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
          className={`block w-full cursor-pointer rounded-control border-none px-2.5 py-1.5 text-left text-[13px] text-[var(--text)] ${index === activeIndex ? 'bg-[var(--surface-2)]' : 'bg-transparent'}`}
        >
          <span className="font-semibold">@{person.full_name}</span>
        </button>
      ))}
    </div>
  )
}
