import { createClient } from '@/lib/supabase/server'
import { listAudiences } from '@/lib/db/outreach'
import { mockupFontVars } from '@/lib/fonts'
import PageHeader from '@/components/ui/PageHeader'

export const metadata = { title: 'Audiences | Trailhead OS' }

export default async function AudiencesPage() {
  const supabase = await createClient()
  const audiences = await listAudiences(supabase).catch(() => [])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="space-y-6">
        <PageHeader
          back={{ href: '/outreach', label: 'Outreach' }}
          title="Audiences"
          description="Static snapshots of contacts. Membership doesn’t change once a campaign is running."
        />

        {audiences.length === 0 ? (
          <div className="empty">No audiences yet. The Engineer OS seed creates one.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Description</th><th style={{ textAlign: 'right' }}>Members</th></tr></thead>
            <tbody>
              {audiences.map((a) => (
                <tr key={a.id}>
                  <td className="td-name">{a.name}</td>
                  <td className="td-sub">{a.description ?? '—'}</td>
                  <td style={{ textAlign: 'right' }} className="td-num">{a.member_count}</td>
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
