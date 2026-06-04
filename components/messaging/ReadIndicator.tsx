/** "Seen at HH:mm" / "Sent" — rendered only under the most-recent SENT message. */
export default function ReadIndicator({ seenAt }: { seenAt: string | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 2px', fontSize: 11, color: 'var(--text-3)' }}>
      {seenAt ? `Seen at ${new Date(seenAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Sent'}
    </div>
  )
}
