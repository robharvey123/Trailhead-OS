import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listSalesProducts } from '@/lib/sales/data'
import { getSalesDashboard, STAGE_LABELS, type WeekStats } from '@/lib/sales/queue'

export const metadata = { title: 'Sales dashboard | Trailhead OS' }

const METRICS: Array<{ key: keyof WeekStats; label: string }> = [
  { key: 'dials', label: 'Dials' },
  { key: 'conversations', label: 'Conversations' },
  { key: 'demosBooked', label: 'Demos booked' },
  { key: 'demosRun', label: 'Demos run' },
  { key: 'trials', label: 'Trials started' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
]

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-3)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[color:var(--text-3)]">{hint}</p> : null}
    </div>
  )
}

export default async function SalesDashboardPage() {
  const supabase = await createClient()
  const [d, products] = await Promise.all([getSalesDashboard(supabase), listSalesProducts(supabase)])
  const maxFunnel = Math.max(1, ...d.funnel.map((f) => f.count))
  const weekLabel = new Date(d.weekStartsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-[color:var(--text-2)]">Week starting Monday {weekLabel}, against the week before.</p>
        </div>
        <Link href="/sales/queue" className="btn btn-primary btn-sm">Open today&apos;s queue</Link>
      </div>

      <section aria-labelledby="week-title" className="panel overflow-x-auto p-4">
        <h2 id="week-title" className="text-sm font-semibold">Activity</h2>
        <table className="data-table mt-2">
          <thead>
            <tr><th>Metric</th><th className="text-right">This week</th><th className="text-right">Last week</th></tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td className="text-right font-semibold tabular-nums">{d.thisWeek[m.key]}</td>
                <td className="text-right tabular-nums text-[color:var(--text-2)]">{d.lastWeek[m.key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-[color:var(--text-3)]">Conversations count CONV, DEMO, TRIAL and WON outcomes. Demos run are DEMO outcomes logged on the Demo channel.</p>
      </section>

      <section aria-label="List health" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="New, not yet called" value={d.listHealth.newRemaining} />
        <Tile label="CTPS-clear now" value={d.listHealth.ctpsClear} hint="Screened clear in the last 28 days" />
        <Tile label="Screened over 21 days ago" value={d.listHealth.screenedOver21Days} hint="Re-screen within a week to keep calling" />
        <Tile label="Needs a CTPS screen" value={d.listHealth.needsScreening} hint="Hidden from the queue until screened" />
      </section>

      <section aria-labelledby="funnel-title" className="panel p-4">
        <div className="flex items-center justify-between">
          <h2 id="funnel-title" className="text-sm font-semibold">Stage funnel</h2>
          <Link href="/sales/pipeline" className="text-sm text-[color:var(--accent-strong)] hover:underline">Pipeline</Link>
        </div>
        <ul className="mt-3 space-y-1.5">
          {d.funnel.map((f) => (
            <li key={f.stage} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="text-[color:var(--text-2)]">{STAGE_LABELS[f.stage]}</span>
              <span className="h-2.5 rounded-full bg-[var(--surface-3)]" aria-hidden="true">
                <span className="block h-2.5 rounded-full bg-[var(--accent)]" style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums">{f.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel p-4">
        <h2 className="text-sm font-semibold">Product context</h2>
        <p className="mt-1 text-xs text-[color:var(--text-3)]">Read-only. Where each product is, so calls can speak to it.</p>
        {products.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--text-3)]">Nothing shared yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {products.map((p) => (
              <li key={p.id}>
                <Link href={`/sales/products/${p.id}`} className="card block hover:border-[var(--accent)]">
                  <span className="block text-sm font-medium">{p.name}</span>
                  {p.status ? <span className="mt-1 block text-xs capitalize text-[color:var(--text-3)]">{p.status}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
