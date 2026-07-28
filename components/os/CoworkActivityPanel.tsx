import Link from 'next/link'
import { revertCoworkActivityAction } from '@/app/(os)/settings/actions'

export interface CoworkActivityRow {
  id: string
  action: string
  entity: string
  entity_id: string | null
  entity_label: string | null
  summary: string
  reverted_at: string | null
  created_at: string
  before: Record<string, unknown> | null
}

const GATE_COLS = ['range_review_decided_at', 'go_live_confirmed_at', 'first_po_received_at']

/** Reversible cases only: invoice status change, time entry create, milestone gate. */
function isReversible(r: CoworkActivityRow): boolean {
  if (r.reverted_at || !r.entity_id) return false
  if (r.entity === 'invoice' && r.action === 'update' && r.before && 'status' in r.before) return true
  if (r.entity === 'time_entry' && r.action === 'create') return true
  if (r.entity === 'tier1_milestone' && r.before && GATE_COLS.some((k) => k in (r.before as object))) return true
  return false
}

function entityHref(r: CoworkActivityRow): string | null {
  if (!r.entity_id) return null
  if (r.entity === 'invoice') return `/invoicing/${r.entity_id}`
  if (r.entity === 'account') return `/crm/accounts/${r.entity_id}`
  return null
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yst = new Date(today.getTime() - 86_400_000)
  const key = (x: Date) => x.toISOString().slice(0, 10)
  if (key(d) === key(today)) return 'Today'
  if (key(d) === key(yst)) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
}

export default function CoworkActivityPanel({ activity }: { activity: CoworkActivityRow[] }) {
  // Group by calendar day, newest first (activity already arrives newest-first).
  const groups: Array<{ label: string; rows: CoworkActivityRow[] }> = []
  for (const row of activity) {
    const label = dayLabel(row.created_at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.rows.push(row)
    else groups.push({ label, rows: [row] })
  }

  return (
    <section className="os-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="os-eyebrow">Cowork</p>
          <h2 className="mt-2 os-section-title">Cowork activity</h2>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--text-2)]">
            Every write Claude made through the Cowork API and MCP tools. Reversible changes (invoice status, logged time, milestone gates) can be undone here.
          </p>
        </div>
      </div>

      {activity.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
          No Cowork activity yet.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">{group.label}</p>
              <ul className="mt-3 space-y-2">
                {group.rows.map((row) => {
                  const href = entityHref(row)
                  const time = new Date(row.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm text-[color:var(--text)]">
                          {href ? <Link href={href} className="hover:underline">{row.summary}</Link> : row.summary}
                        </p>
                        <p className="mt-0.5 text-xs text-[color:var(--text-3)]">
                          {time} · {row.entity} · {row.action}
                          {row.reverted_at ? ' · reverted' : ''}
                        </p>
                      </div>
                      {isReversible(row) ? (
                        <form action={revertCoworkActivityAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <button className="rounded-xl border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--text-2)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--text)]">
                            Revert
                          </button>
                        </form>
                      ) : row.reverted_at ? (
                        <span className="text-xs text-[color:var(--text-3)]">reverted</span>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
