import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listThreads } from '@/lib/db/inbox'
import { getAccounts } from '@/lib/db/accounts'
import { getAllGoogleTokens } from '@/lib/google/oauth'
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

  const [threads, accounts, tokens] = await Promise.all([
    listThreads({ folder: 'all' }, supabase).catch(() => []),
    getAccounts({}, supabase).catch(() => []),
    getAllGoogleTokens().catch(() => []),
  ])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <InboxClient
        initialThreads={threads}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        connected={tokens.length > 0}
        selfEmail={user.email ?? ''}
      />
    </div>
  )
}
