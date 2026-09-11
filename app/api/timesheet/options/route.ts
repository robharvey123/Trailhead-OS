import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getAccounts } from '@/lib/db/accounts'
import { getProjects } from '@/lib/db/projects'
import { currentPeriodHoursByEngagement, listEngagements } from '@/lib/db/engagements'
import { listPeople, getPersonByAuthUser } from '@/lib/db/people'
import { NextResponse } from 'next/server'

// GET /api/timesheet/options — the option lists TimeEntryForm needs, so the
// timer bar / Log-time buttons can open the form from anywhere without every
// page prop-drilling accounts/projects/engagements/people/tasks.
export async function GET() {
  try {
    const { ok, response, supabase, user } = await getAuthenticatedSupabase()
    if (!ok) return response

    const [accounts, projects, engagements, people, ownPerson, taskRows] = await Promise.all([
      getAccounts({}, supabase).catch(() => []),
      getProjects({}, supabase).catch(() => []),
      listEngagements({ status: 'Active' }, supabase).catch(() => []),
      listPeople({ activeOnly: true }, supabase).catch(() => []),
      user ? getPersonByAuthUser(user.id, supabase).catch(() => null) : null,
      supabase
        .from('engagement_tasks')
        .select('id, title, engagement_id, project_id, client_description')
        .not('status', 'in', '(done,cancelled)')
        .order('updated_at', { ascending: false })
        .limit(500),
    ])

    const periodHours = await currentPeriodHoursByEngagement(engagements, supabase).catch(() => new Map())

    return NextResponse.json({
      accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
      projects: projects.map((p) => ({ id: p.id, name: p.name, account_id: p.account_id ?? null, engagement_id: p.engagement_id ?? null })),
      engagements: engagements.map((e) => ({
        id: e.id,
        name: e.name,
        included_hours_monthly: e.included_hours_monthly,
        account_id: e.end_client_account_id,
        hours_used_mtd: periodHours.get(e.id)?.used ?? 0,
        is_billable: e.is_billable,
      })),
      people: people.map((p) => ({ id: p.id, name: p.full_name })),
      tasks: (taskRows.data ?? []) as Array<{ id: string; title: string; engagement_id: string | null; project_id: string | null; client_description: string | null }>,
      defaultPersonId: ownPerson?.id ?? null,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load options' }, { status: 500 })
  }
}
