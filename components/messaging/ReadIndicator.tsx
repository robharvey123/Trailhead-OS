/** "Seen at HH:mm" (DM) / "Seen by N" (channel) / "Sent" — under the latest sent message. */
export default function ReadIndicator({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 2px', fontSize: 11, color: 'var(--text-3)' }}>
      {label}
    </div>
  )
}
