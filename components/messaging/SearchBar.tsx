'use client'

export default function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative border-b border-[var(--border)] p-3">
      <input
        className="w-full rounded-control border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 pr-8 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        placeholder="Search messages…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-5 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent text-[var(--text-3)]"
        >
          ✕
        </button>
      ) : null}
    </div>
  )
}
