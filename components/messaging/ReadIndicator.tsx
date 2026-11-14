/** "Seen at HH:mm" (DM) / "Seen by N" (channel) / "Sent" — under the latest sent message. */
export default function ReadIndicator({ label }: { label: string }) {
  return (
    <div className="flex justify-end px-0.5 text-[11px] text-[var(--text-3)]">
      {label}
    </div>
  )
}
