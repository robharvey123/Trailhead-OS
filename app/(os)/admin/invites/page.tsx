import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, roleIsAdmin } from '@/lib/auth/roles'
import { listInvites } from '@/lib/db/invites'
import { listPeople } from '@/lib/db/people'
import { mockupFontVars } from '@/lib/fonts'
import InvitesClient from './InvitesClient'

export const dynamic = 'force-dynamic'

export default async function AdminInvitesPage() {
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase)
  if (!profile) redirect('/login')
  if (!roleIsAdmin(profile.role)) redirect('/')

  const [invites, people] = await Promise.all([
    listInvites({}, supabase).catch(() => []),
    listPeople({ activeOnly: true }, supabase).catch(() => []),
  ])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <InvitesClient invites={invites} people={people.map((p) => ({ id: p.id, name: p.full_name }))} />
    </div>
  )
}
