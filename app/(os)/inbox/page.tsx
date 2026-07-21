import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listThreads } from '@/lib/db/inbox'
import { getAccounts } from '@/lib/db/accounts'
import { getAllGoogleTokens } from '@/lib/google/oauth'
import { getCompanySettings } from '@/lib/company-settings'
import { mockupFontVars } from '@/lib/fonts'
import InboxClient from '@/components/os/inbox/InboxClient'

export const metadata = {
  title: 'Inbox | Trailhead OS',
}

export default async function InboxPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [threads, accounts, tokens, contactsRes, settings] = await Promise.all([
    listThreads({ folder: 'all' }, supabase).catch(() => []),
    getAccounts({}, supabase).catch(() => []),
    getAllGoogleTokens().catch(() => []),
    supabase.from('contacts').select('id, name, email, account_id').not('email', 'is', null),
    getCompanySettings(supabase).catch(() => null),
  ])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <InboxClient
        initialThreads={threads}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        contacts={(contactsRes.data ?? []) as Array<{ id: string; name: string; email: string | null; account_id: string | null }>}
        connected={tokens.length > 0}
        selfEmail={user.email ?? ''}
        selfEmails={Array.from(new Set([user.email, ...tokens.map((t) => t.email)].filter((e): e is string => Boolean(e))))}
        signature={settings?.email_signature ?? ''}
      />
    </div>
  )
}
