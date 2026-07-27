import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listCampaignsWithStats } from '@/lib/db/outreach'
import { OUTREACH_CAMPAIGN_STATUS_LABELS } from '@/lib/types'
import { mockupFontVars } from '@/lib/fonts'

export const metadata = { title: 'Outreach | Trailhead OS' }

export default async function OutreachPage() {
  const supabase = await createClient()
  const campaigns = await listCampaignsWithStats(supabase).catch(() => [])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Outreach</h1>
            <p className="text-sm text-[var(--muted)]">Cold email campaigns and the follow-up call queue.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link className="btn btn-ghost btn-sm" href="/outreach/audiences">Audiences</Link>
            <Link className="btn btn-ghost btn-sm" href="/outreach/templates">Templates</Link>
            <Link className="btn btn-ghost btn-sm" href="/outreach/calls">Call queue</Link>
            <Link className="btn btn-primary btn-sm" href="/outreach/new">+ New campaign</Link>
          </div>
        </div>

        {campaigns.length === 0 ? (
          <div className="empty">No campaigns yet. Create one, or run the Engineer OS seed.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign</th><th>Status</th><th style={{ textAlign: 'right' }}>Audience</th>
                <th style={{ textAlign: 'right' }}>Sent</th><th style={{ textAlign: 'right' }}>Delivered</th>
                <th style={{ textAlign: 'right' }}>Opened</th><th style={{ textAlign: 'right' }}>Replied</th>
                <th style={{ textAlign: 'right' }}>Stopped</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="row-link">
                  <td className="td-name">
                    <Link href={`/outreach/${c.id}`}>{c.name}</Link>
                    <div className="td-sub">{c.audience_name ?? 'No audience'}</div>
                  </td>
                  <td><span className="meta-chip">{OUTREACH_CAMPAIGN_STATUS_LABELS[c.status]}</span></td>
                  <td style={{ textAlign: 'right' }} className="td-mono">{c.stats?.audience_size ?? 0}</td>
                  <td style={{ textAlign: 'right' }} className="td-mono">{c.stats?.sent ?? 0}</td>
                  <td style={{ textAlign: 'right' }} className="td-mono">{c.stats?.delivered ?? 0}</td>
                  <td style={{ textAlign: 'right' }} className="td-mono">{c.stats?.opened ?? 0}</td>
                  <td style={{ textAlign: 'right' }} className="td-mono">{c.stats?.replied ?? 0}</td>
                  <td style={{ textAlign: 'right' }} className="td-mono">{c.stats?.stopped ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
