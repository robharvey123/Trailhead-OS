/** Three animated dots + "{name} is typing…", shown below the last message. */
export default function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-0.5 text-xs text-[var(--text-3)]">
      <span className="inline-flex gap-[3px]">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </span>
      <span>{name} is typing…</span>
    </div>
  )
}
