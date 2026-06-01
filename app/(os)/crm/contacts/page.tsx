import { getAccounts } from '@/lib/db/accounts'
import { getContacts } from '@/lib/db/contacts'
import { mockupFontVars } from '@/lib/fonts'
import { createClient } from '@/lib/supabase/server'
import ContactsClient from '@/components/os/crm/ContactsClient'

export const metadata = {
  title: 'Contacts | Trailhead OS',
}

export default async function ContactsPage() {
  const supabase = await createClient()
  const [contacts, accounts] = await Promise.all([
    getContacts({}, supabase).catch(() => []),
    getAccounts({}, supabase).catch(() => []),
  ])

  const channels = Array.from(
    new Set(contacts.map((c) => c.channel).filter((c): c is string => Boolean(c)))
  ).sort()

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <ContactsClient
        contacts={contacts}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        channels={channels}
      />
    </div>
  )
}
