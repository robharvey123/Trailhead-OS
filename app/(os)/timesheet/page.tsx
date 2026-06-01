import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccounts } from '@/lib/db/accounts'
import { getProjects } from '@/lib/db/projects'
import { getRunningTimer } from '@/lib/db/timesheet'
import { mockupFontVars } from '@/lib/fonts'
import TimesheetClient from '@/components/os/TimesheetClient'

export const metadata = {
  title: 'Timesheet | Trailhead OS',
}

export default async function TimesheetPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [accounts, projects, runningTimer] = await Promise.all([
    getAccounts({}, supabase).catch(() => []),
    getProjects({}, supabase).catch(() => []),
    getRunningTimer(supabase).catch(() => null),
  ])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <TimesheetClient
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name, account_id: p.account_id ?? null }))}
        initialTimer={runningTimer}
      />
    </div>
  )
}
