import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccounts } from '@/lib/db/accounts'
import { mockupFontVars } from '@/lib/fonts'
import EngagementForm from '@/components/os/engagements/EngagementForm'

export const metadata = { title: 'New engagement | Trailhead OS' }

export default async function NewEngagementPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const accounts = await getAccounts({}, supabase).catch(() => [])

  return (
    <div className={`thmock ${mockupFontVars}`} style={{ padding: 24 }}>
      <EngagementForm accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
    </div>
  )
}
