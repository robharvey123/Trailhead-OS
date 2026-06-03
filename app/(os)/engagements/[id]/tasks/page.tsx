import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth/roles'
import { listEngagementTasks } from '@/lib/db/engagement-tasks'
import { listPeople } from '@/lib/db/people'
import { mockupFontVars } from '@/lib/fonts'
import EngagementTasksClient from './EngagementTasksClient'

export const dynamic = 'force-dynamic'

export default async function EngagementTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase)
  if (!profile) redirect('/login')

  // RLS scopes this — a user with no access to the engagement gets null → 404.
  const { data: engagement } = await supabase.from('engagements').select('id, name').eq('id', id).maybeSingle()
  if (!engagement) notFound()

  const [tasks, people] = await Promise.all([
    listEngagementTasks(id, supabase).catch(() => []),
    listPeople({ activeOnly: true }, supabase).catch(() => []),
  ])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="panel overflow-hidden">
        <div className="topbar">
          <Link href={`/engagements/${id}`} className="td-mono" style={{ textDecoration: 'none', color: 'var(--text-3)' }}>‹ {engagement.name}</Link>
          <span className="topbar-title">Tasks</span>
        </div>
        <div style={{ padding: 24 }}>
          <EngagementTasksClient
            engagementId={id}
            initialTasks={tasks}
            people={people.map((p) => ({ id: p.id, name: p.full_name }))}
          />
        </div>
      </div>
    </div>
  )
}
