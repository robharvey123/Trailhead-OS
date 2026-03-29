import QuoteForm from '@/components/os/QuoteForm'
import { getAccounts } from '@/lib/db/accounts'
import { getContacts } from '@/lib/db/contacts'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams?: Promise<{ account_id?: string; enquiry_id?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const [accounts, contacts, workstreams] = await Promise.all([
    getAccounts({}, supabase).catch(() => []),
    getContacts({}, supabase).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
  ])

  return (
    <QuoteForm
      accounts={accounts}
      contacts={contacts}
      workstreams={workstreams}
      initialAccountId={resolvedSearchParams?.account_id ?? ''}
      initialEnquiryId={resolvedSearchParams?.enquiry_id ?? ''}
    />
  )
}
