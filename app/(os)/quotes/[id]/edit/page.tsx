import { redirect } from 'next/navigation'
import QuoteForm from '@/components/os/QuoteForm'
import { getAccounts } from '@/lib/db/accounts'
import { getContacts } from '@/lib/db/contacts'
import { getProjects } from '@/lib/db/projects'
import { getQuoteById } from '@/lib/db/quotes'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const quote = await getQuoteById(id, supabase).catch(() => null)

  if (!quote) {
    redirect('/quotes')
  }

  if (quote.status === 'accepted' || quote.status === 'converted') {
    redirect(`/quotes/${quote.id}?warning=edit-blocked`)
  }

  const [accounts, contacts, workstreams, projects] = await Promise.all([
    getAccounts({}, supabase).catch(() => []),
    getContacts({}, supabase).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
    getProjects({}, supabase).catch(() => []),
  ])

  return (
    <QuoteForm
      accounts={accounts}
      contacts={contacts}
      workstreams={workstreams}
      projects={projects}
      initialQuote={quote}
    />
  )
}
