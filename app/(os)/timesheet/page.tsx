import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccounts } from '@/lib/db/accounts'
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

  const accounts = await getAccounts({}, supabase)

  return <TimesheetClient accounts={accounts} />
}
