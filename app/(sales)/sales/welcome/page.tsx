import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth/roles'
import PageHeader from '@/components/ui/PageHeader'
import WelcomeForm from './WelcomeForm'

export const metadata = { title: 'Welcome | Sales | Trailhead OS' }

export default async function SalesWelcomePage() {
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase).catch(() => null)
  return (
    <div className="mx-auto max-w-md panel p-6">
      <PageHeader
        title="Welcome to Trailhead OS"
        description="One step: confirm your name and choose a password."
      />
      <WelcomeForm initialName={profile?.display_name ?? ''} />
    </div>
  )
}
