import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth/roles'
import { listMyTasks } from '@/lib/db/engagement-tasks'
import { listPeople } from '@/lib/db/people'
import { listEngagements } from '@/lib/db/engagements'
import { mockupFontVars } from '@/lib/fonts'
import MyWorkClient from './MyWorkClient'

export const dynamic = 'force-dynamic'

export default async function MyWorkPage() {
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase)
  if (!profile) redirect('/login')

  if (!profile.person_id) {
    return (
      <div className={`thmock ${mockupFontVars}`}>
        <div className="panel" style={{ padding: 24 }}>
          <h1 className="topbar-title">My work</h1>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8 }}>
            Your login isn’t linked to a person record yet, so there are no tasks to show. Ask an admin to link one.
          </p>
        </div>
      </div>
    )
  }

  const personId = profile.person_id
  const [assigned, reported, engagementTasks, people, engagements] = await Promise.all([
    listMyTasks('assigned', personId, supabase).catch(() => []),
    listMyTasks('reported', personId, supabase).catch(() => []),
    listMyTasks('engagements', personId, supabase).catch(() => []),
    listPeople({ activeOnly: true }, supabase).catch(() => []),
    listEngagements({ status: 'Active' }, supabase).catch(() => []),
  ])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <MyWorkClient
        assigned={assigned}
        reported={reported}
        engagementTasks={engagementTasks}
        people={people.map((p) => ({ id: p.id, name: p.full_name }))}
        engagements={engagements.map((e) => ({ id: e.id, name: e.name }))}
      />
    </div>
  )
}
