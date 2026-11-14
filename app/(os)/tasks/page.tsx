import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth/roles'
import { listMyTasks } from '@/lib/db/engagement-tasks'
import { listPeople } from '@/lib/db/people'
import { listEngagements } from '@/lib/db/engagements'
import { mockupFontVars } from '@/lib/fonts'
import PageHeader from '@/components/ui/PageHeader'
import MyWorkClient from '../my-work/MyWorkClient'

export const metadata = { title: 'Tasks' }

export const dynamic = 'force-dynamic'

// /tasks now serves the engagement_tasks views (assigned to me / reported by me /
// all my engagements). The legacy `tasks` master list previously rendered here;
// the new views are canonical, and /my-work redirects here.
export default async function TasksPage() {
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase)
  if (!profile) redirect('/login')

  if (!profile.person_id) {
    return (
      <div className={`thmock ${mockupFontVars}`}>
        <PageHeader title="Tasks" />
        <div className="panel p-6">
          <p className="text-[13px] text-[var(--text-2)]">
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
        currentPersonId={personId}
        assigned={assigned}
        reported={reported}
        engagementTasks={engagementTasks}
        people={people.map((p) => ({ id: p.id, name: p.full_name }))}
        engagements={engagements.map((e) => ({ id: e.id, name: e.name }))}
      />
    </div>
  )
}
