import Link from 'next/link'
import { redirect } from 'next/navigation'
import ActiveProjectTasks from '@/components/os/ActiveProjectTasks'
import DailyBriefClient from '@/components/os/DailyBriefClient'
import { getDailyBriefData } from '@/lib/db/daily-brief'
import { createClient } from '@/lib/supabase/server'

function formatDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayLabel = formatDate(today)
  const dailyBrief = await getDailyBriefData(user.id, today, supabase)

  // How many changes Claude made today, for the activity strip.
  let coworkChangesToday = 0
  try {
    const { count } = await supabase
      .from('cowork_activity')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())
    coworkChangesToday = count ?? 0
  } catch {}

  return (
    <div className="space-y-6">
      {coworkChangesToday > 0 ? (
        <div className="mx-auto max-w-[780px]">
          <Link
            href="/settings"
            className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--text)]"
          >
            <span>Claude made {coworkChangesToday} change{coworkChangesToday === 1 ? '' : 's'} today</span>
            <span className="text-xs text-[color:var(--text-3)]">Review →</span>
          </Link>
        </div>
      ) : null}
      <div className="mx-auto max-w-[780px]">
        <ActiveProjectTasks />
      </div>
      <DailyBriefClient today={todayLabel} initialData={dailyBrief} />
    </div>
  )
}
