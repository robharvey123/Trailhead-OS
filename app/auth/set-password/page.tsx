import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuthShell from '@/components/os/AuthShell'
import SetPasswordForm from './SetPasswordForm'

export const metadata = { title: 'Choose a new password | Trailhead OS' }

export default async function SetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?error=link_expired')
  return (
    <AuthShell title="Choose a new password" description={<>Signed in as {user.email}.</>}>
      <SetPasswordForm />
    </AuthShell>
  )
}
