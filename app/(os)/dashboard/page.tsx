import { redirect } from 'next/navigation'
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

  return <DailyBriefClient today={todayLabel} initialData={dailyBrief} />
}
