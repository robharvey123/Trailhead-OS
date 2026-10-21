import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SetPasswordForm from './SetPasswordForm'

export const metadata = { title: 'Choose a new password | Trailhead OS' }

export default async function SetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?error=link_expired')
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <p className="mt-2 text-sm text-slate-300">Signed in as {user.email}.</p>
        <SetPasswordForm />
      </div>
    </div>
  )
}
