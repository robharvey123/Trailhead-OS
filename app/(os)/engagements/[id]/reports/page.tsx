import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, roleIsAdmin } from '@/lib/auth/roles'
import GenerateReportControls from '@/components/os/engagements/GenerateReportControls'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = {
  weekly_client: 'Weekly',
  monthly_client: 'Monthly',
  weekly_internal: 'Internal',
}

export default async function EngagementReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase)
  if (!profile) redirect('/login')

  const { data: engagement } = await supabase.from('engagements').select('id, name, is_billable, currency').eq('id', id).maybeSingle()
  if (!engagement) notFound()

  const { data: reports } = await supabase
    .from('engagement_reports')
    .select('id, kind, period_start, period_end, status, total_hours, total_value_gbp, sent_at')
    .eq('engagement_id', id)
    .order('period_start', { ascending: false })

  const isAdmin = roleIsAdmin(profile.role)
  const money = (v: number | null) =>
    v == null ? '—' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: engagement.currency ?? 'GBP', maximumFractionDigits: 0 }).format(v)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/engagements/${id}`} className="text-sm text-[color:var(--text-3)] hover:text-[color:var(--text)]">‹ {engagement.name}</Link>
          <h1 className="os-page-title mt-1">Reports</h1>
        </div>
        {isAdmin ? <GenerateReportControls engagementId={id} /> : null}
      </div>

      {!isAdmin ? (
        <p className="text-sm text-[color:var(--text-3)]">Reports are available to admins.</p>
      ) : !reports || reports.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
          No reports yet. Generate a weekly or monthly report above.
        </div>
      ) : (
        <div className="os-card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-left text-[11px] uppercase tracking-[0.14em] text-[color:var(--text-3)]">
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Hours</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-[color:var(--border)] hover:bg-[var(--surface-2)]">
                  <td className="px-4 py-3 tabular-nums">{r.period_start} → {r.period_end}</td>
                  <td className="px-4 py-3">{KIND_LABEL[r.kind] ?? r.kind}</td>
                  <td className="px-4 py-3">
                    <span className={`tag-chip ${r.status === 'sent' ? 'emerald' : r.status === 'archived' ? 'grey' : 'amber'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.total_hours != null ? `${Number(r.total_hours).toFixed(1)}h` : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{engagement.is_billable ? money(r.total_value_gbp as number | null) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/engagements/${id}/reports/${r.id}`} className="text-xs text-[color:var(--accent-strong)] hover:underline">
                      {r.status === 'draft' ? 'Review →' : 'View →'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
