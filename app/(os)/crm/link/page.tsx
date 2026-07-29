import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LinkBacklogClient from '@/components/os/crm/LinkBacklogClient'

export const metadata = { title: 'Linking backlog | Trailhead OS' }

export default async function CrmLinkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-5xl p-6">
      <LinkBacklogClient />
    </div>
  )
}
