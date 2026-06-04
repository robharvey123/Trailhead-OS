/** Three animated dots + "{name} is typing…", shown below the last message. */
export default function TypingIndicator({ name }: { name: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px', fontSize: 12, color: 'var(--text-3)' }}>
      <span style={{ display: 'inline-flex', gap: 3 }}>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </span>
      <span>{name} is typing…</span>
    </div>
  )
}
