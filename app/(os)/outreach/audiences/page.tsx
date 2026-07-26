import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listAudiences } from '@/lib/db/outreach'
import { mockupFontVars } from '@/lib/fonts'

export const metadata = { title: 'Audiences | Trailhead OS' }

export default async function AudiencesPage() {
  const supabase = await createClient()
  const audiences = await listAudiences(supabase).catch(() => [])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <Link href="/outreach" className="text-sm text-[var(--muted)] hover:text-white">← Outreach</Link>
          <h1 className="mt-3 text-2xl font-semibold text-white">Audiences</h1>
          <p className="text-sm text-[var(--muted)]">Static snapshots of contacts. Membership doesn’t change once a campaign is running.</p>
        </div>

        {audiences.length === 0 ? (
          <div className="empty">No audiences yet. The Engineer OS seed creates one.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Description</th><th style={{ textAlign: 'right' }}>Members</th></tr></thead>
            <tbody>
              {audiences.map((a) => (
                <tr key={a.id}>
                  <td className="td-name">{a.name}</td>
                  <td className="td-sub">{a.description ?? '—'}</td>
                  <td style={{ textAlign: 'right' }} className="td-mono">{a.member_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
