import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listCampaignsWithStats } from '@/lib/db/outreach'
import { OUTREACH_CAMPAIGN_STATUS_LABELS } from '@/lib/types'
import { mockupFontVars } from '@/lib/fonts'
import PageHeader from '@/components/ui/PageHeader'

export const metadata = { title: 'Outreach' }

export default async function OutreachPage() {
  const supabase = await createClient()
  const campaigns = await listCampaignsWithStats(supabase).catch(() => [])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="space-y-6">
        <PageHeader
          title="Outreach"
          description="Cold email campaigns and the follow-up call queue."
          actions={
            <>
              <Link className="btn btn-ghost btn-sm" href="/outreach/audiences">Audiences</Link>
              <Link className="btn btn-ghost btn-sm" href="/outreach/templates">Templates</Link>
              <Link className="btn btn-ghost btn-sm" href="/outreach/calls">Call queue</Link>
              <Link className="btn btn-primary btn-sm" href="/outreach/new">+ New campaign</Link>
            </>
          }
        />

        {campaigns.length === 0 ? (
          <div className="empty">No campaigns yet. Create one, or run the Engineer OS seed.</div>
        ) : (
          <div className="panel overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign</th><th>Status</th><th className="text-right!">Audience</th>
                <th className="text-right!">Sent</th><th className="text-right!">Delivered</th>
                <th className="text-right!">Opened</th><th className="text-right!">Replied</th>
                <th className="text-right!">Stopped</th>
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
                  <td className="td-num text-right">{c.stats?.audience_size ?? 0}</td>
                  <td className="td-num text-right">{c.stats?.sent ?? 0}</td>
                  <td className="td-num text-right">{c.stats?.delivered ?? 0}</td>
                  <td className="td-num text-right">{c.stats?.opened ?? 0}</td>
                  <td className="td-num text-right">{c.stats?.replied ?? 0}</td>
                  <td className="td-num text-right">{c.stats?.stopped ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
