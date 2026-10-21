import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth/roles'
import WelcomeForm from './WelcomeForm'

export const metadata = { title: 'Welcome | Sales | Trailhead OS' }

export default async function SalesWelcomePage() {
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase).catch(() => null)
  return (
    <div className="mx-auto max-w-md panel p-6">
      <h1 className="text-xl font-semibold tracking-tight">Welcome to Trailhead OS</h1>
      <p className="mt-1 mb-5 text-sm text-[color:var(--text-2)]">One step: confirm your name and choose a password.</p>
      <WelcomeForm initialName={profile?.display_name ?? ''} />
    </div>
  )
}
