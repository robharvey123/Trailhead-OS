import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { weeklyClientUpdateData } from '@/lib/db/engagements'
import { renderWeeklyUpdate } from '@/lib/templates/weeklyUpdate'
import { mockupFontVars } from '@/lib/fonts'
import WeeklyUpdateClient from '@/components/os/engagements/WeeklyUpdateClient'

function mondayOfThisWeek() {
  const d = new Date()
  const day = d.getDay()
  const monday = new Date(d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)))
  return monday.toISOString().split('T')[0]
}

export default async function WeeklyUpdatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ week_start?: string }>
}) {
  const { id } = await params
  const sp = searchParams ? await searchParams : undefined
  const weekStart = sp?.week_start || mondayOfThisWeek()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const data = await weeklyClientUpdateData(id, weekStart, supabase).catch(() => null)
  if (!data || !data.engagement) notFound()

  const markdown = renderWeeklyUpdate(data)

  // Recipient emails: contacts at the end-client and billed-via accounts.
  const accountIds = [data.engagement.end_client_account_id, data.engagement.billed_via_account_id].filter(Boolean) as string[]
  const { data: contacts } = await supabase
    .from('contacts')
    .select('email, account_id')
    .in('account_id', accountIds)
    .not('email', 'is', null)

  const to = (contacts ?? []).filter((c) => c.account_id === data.engagement.end_client_account_id).map((c) => c.email).filter(Boolean) as string[]
  const cc = (contacts ?? []).filter((c) => c.account_id === data.engagement.billed_via_account_id).map((c) => c.email).filter(Boolean) as string[]

  const subject = `${data.engagement.end_client?.name ?? 'Engagement'} weekly update — week ending ${new Date(data.weekEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`

  return (
    <div className={`thmock ${mockupFontVars}`} style={{ padding: 24 }}>
      <WeeklyUpdateClient
        engagementId={id}
        weekStart={weekStart}
        initialMarkdown={markdown}
        to={to.slice(0, 1)}
        cc={cc.slice(0, 1)}
        subject={subject}
      />
    </div>
  )
}
