import { createClient } from '@/lib/supabase/server'
import { getAccounts } from '@/lib/db/accounts'
import { listTags, accountTagMap } from '@/lib/db/tags'
import { listSavedViews } from '@/lib/db/saved-views'
import { mockupFontVars } from '@/lib/fonts'
import AccountsClient from '@/components/os/crm/AccountsClient'

export const metadata = {
  title: 'CRM | Trailhead OS',
}

export default async function AccountsPage() {
  const supabase = await createClient()

  const [accounts, tags, tagMap, views] = await Promise.all([
    getAccounts({}, supabase).catch(() => []),
    listTags(supabase).catch(() => []),
    accountTagMap(supabase).catch(() => ({})),
    listSavedViews('accounts', supabase).catch(() => []),
  ])

  const channels = Array.from(
    new Set(accounts.map((a) => a.channel).filter((c): c is string => Boolean(c)))
  ).sort()

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <AccountsClient
        initialAccounts={accounts}
        allTags={tags}
        accountTags={tagMap}
        channels={channels}
        savedViews={views}
      />
    </div>
  )
}
