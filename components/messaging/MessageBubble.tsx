function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** A single message bubble — right-aligned + accent for the current user, left for the other. */
export default function MessageBubble({ body, mine, at, pending }: { body: string; mine: boolean; at: string; pending?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '72%',
          padding: '8px 12px',
          borderRadius: 14,
          fontSize: 14,
          lineHeight: 1.4,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          background: mine ? 'var(--accent)' : 'var(--surface-2)',
          color: mine ? '#fff' : 'var(--text)',
          opacity: pending ? 0.6 : 1,
        }}
      >
        <span>{body}</span>
        <span style={{ display: 'block', fontSize: 10, opacity: 0.7, marginTop: 2, textAlign: 'right' }}>
          {pending ? 'sending…' : fmtTime(at)}
        </span>
      </div>
    </div>
  )
}
