import Link from 'next/link'
import { formatCurrency } from '@/lib/format'
import type { EngagementHealth, PortfolioOverview as PortfolioData, ProjectHealth } from '@/lib/db/portfolio'

const card = 'rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4 transition hover:border-[color:var(--accent)]'
// `.tag-chip` is the design system's own status vocabulary, with AA-passing
// -strong/-dim token pairs. The raw `bg-emerald-100 text-slate-600` palette
// classes this used to carry were a second, unaudited status language.
const pill = 'tag-chip'

function fmtDate(iso: string): string {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso)
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(d)
}

const ENG_STATUS: Record<string, string> = {
  Active: 'emerald', Paused: 'amber', Draft: 'grey',
}
const PROJ_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'emerald' },
  planning: { label: 'Planning', cls: 'accent' },
  on_hold: { label: 'On hold', cls: 'amber' },
}

/** A used/allowance bar. Colour escalates as the month's hours approach and pass the cap. */
function HoursBar({ used, cap }: { used: number; cap: number | null }) {
  if (cap == null || cap === 0) {
    return (
      <div className="mt-2 flex items-baseline justify-between text-xs text-[color:var(--text-2)]">
        <span className="font-semibold text-[color:var(--text)]">{used.toFixed(1)}h</span>
        <span className="text-[color:var(--text-3)]">no monthly cap</span>
      </div>
    )
  }
  const pct = Math.min(100, Math.round((used / cap) * 100))
  const over = used > cap
  const bar = over ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-[var(--accent)]'
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-[color:var(--text)]">{used.toFixed(1)}h <span className="font-normal text-[color:var(--text-3)]">/ {cap}h</span></span>
        <span className={over ? 'font-semibold text-rose-600' : 'text-[color:var(--text-3)]'}>
          {over ? `+${(used - cap).toFixed(1)}h over` : `${pct}%`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  )
}

function EngagementCard({ e }: { e: EngagementHealth }) {
  return (
    <Link href={`/engagements/${e.id}`} className={card}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[color:var(--text)]">{e.client ?? e.name}</p>
          <p className="truncate text-xs text-[color:var(--text-3)]">{e.client ? e.name : e.code ?? ' '}</p>
        </div>
        <span className={`${pill} ${ENG_STATUS[e.status] ?? 'bg-slate-100 text-slate-600'}`}>{e.status}</span>
      </div>
      <HoursBar used={e.hoursUsed} cap={e.includedHours} />
      {e.retainer ? (
        <p className="mt-2 text-[11px] text-[color:var(--text-3)]">{formatCurrency(e.retainer, e.currency)}/mo retainer</p>
      ) : null}
    </Link>
  )
}

function ProjectCard({ p }: { p: ProjectHealth }) {
  const pct = p.taskTotal ? Math.round((p.taskDone / p.taskTotal) * 100) : 0
  const status = PROJ_STATUS[p.status] ?? { label: p.status, cls: 'bg-slate-100 text-slate-600' }
  return (
    <Link href={`/projects/records/${p.id}`} className={card}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[color:var(--text)]">{p.name}</p>
          <p className="truncate text-xs text-[color:var(--text-3)]">{[p.account, p.workstream].filter(Boolean).join(' · ') || ' '}</p>
        </div>
        <span className={`${pill} ${status.cls}`}>{status.label}</span>
      </div>
      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-semibold text-[color:var(--text)]">{p.taskDone}<span className="font-normal text-[color:var(--text-3)]">/{p.taskTotal} tasks</span></span>
          <span className="text-[color:var(--text-3)]">{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
      </div>
      {p.nextMilestone ? (
        <p className="mt-2 truncate text-[11px] text-[color:var(--text-3)]">Next: {p.nextMilestone.name} · {fmtDate(p.nextMilestone.date)}</p>
      ) : null}
    </Link>
  )
}

function Stat({ value, label, tone }: { value: number | string; label: string; tone?: 'warn' }) {
  return (
    <div className="flex flex-col">
      <span className={`text-2xl font-bold ${tone === 'warn' ? 'text-rose-600' : 'text-[color:var(--text)]'}`}>{value}</span>
      <span className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-3)]">{label}</span>
    </div>
  )
}

export default function PortfolioOverview({ data }: { data: PortfolioData }) {
  const { engagements, projects, counts } = data
  if (engagements.length === 0 && projects.length === 0) return null

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-5 py-4">
        <Stat value={counts.engagementsActive} label="Active engagements" />
        <Stat value={counts.projectsActive} label="Active projects" />
        <Stat value={`${counts.hoursThisMonth}h`} label="Logged this month" />
        {counts.overCap > 0 ? <Stat value={counts.overCap} label="Over allowance" tone="warn" /> : null}
      </div>

      {engagements.length ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[color:var(--text)]">Engagements</h2>
            <Link href="/engagements" className="text-xs text-[color:var(--text-3)] hover:text-[color:var(--accent)]">All →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {engagements.map((e) => <EngagementCard key={e.id} e={e} />)}
          </div>
        </div>
      ) : null}

      {projects.length ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[color:var(--text)]">Projects</h2>
            <Link href="/projects" className="text-xs text-[color:var(--text-3)] hover:text-[color:var(--accent)]">All →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => <ProjectCard key={p.id} p={p} />)}
          </div>
        </div>
      ) : null}
    </section>
  )
}
