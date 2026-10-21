import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentProfile, roleIsAdmin } from '@/lib/auth/roles'
import { getVerifiedSendingDomains } from '@/lib/sales/sender'
import { SenderIdentityForm, SendingDomainsForm } from './SettingsForms'

export const metadata = { title: 'Settings | Sales | Trailhead OS' }

export default async function SalesSettingsPage() {
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase).catch(() => null)
  const isAdmin = roleIsAdmin(profile?.role)
  const [{ data: identity }, domains] = await Promise.all([
    supabase.from('user_sender_identities').select('from_name, from_email, reply_to').eq('user_id', profile?.id ?? '').maybeSingle(),
    getVerifiedSendingDomains(createAdminClient()),
  ])
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[color:var(--text-2)]">The address your one-to-one follow-up emails come from. Campaign emails are unchanged.</p>
      </div>
      <section className="panel p-4" aria-labelledby="sender-title">
        <h2 id="sender-title" className="mb-3 text-sm font-semibold">Your sender identity</h2>
        <SenderIdentityForm initial={{ fromName: identity?.from_name ?? '', fromEmail: identity?.from_email ?? '', replyTo: identity?.reply_to ?? '' }} />
        <p className="mt-3 text-xs text-[color:var(--text-3)]">Allowed domains: {domains.length ? domains.join(', ') : 'none yet'}.</p>
      </section>
      {isAdmin ? (
        <section className="panel p-4" aria-labelledby="domains-title">
          <h2 id="domains-title" className="mb-3 text-sm font-semibold">Sending domains (owner only)</h2>
          <SendingDomainsForm initial={domains} />
        </section>
      ) : null}
    </div>
  )
}
