'use client'

export default function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ padding: 12, borderBottom: '1px solid var(--border)', position: 'relative' }}>
      <input
        className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 pr-8 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        placeholder="Search messages…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)' }}
        >
          ✕
        </button>
      ) : null}
    </div>
  )
}
