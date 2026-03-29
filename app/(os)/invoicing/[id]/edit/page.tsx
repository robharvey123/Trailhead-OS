import { redirect } from 'next/navigation'
import InvoiceForm from '@/components/os/InvoiceForm'
import { getAccounts } from '@/lib/db/accounts'
import { getContacts } from '@/lib/db/contacts'
import { getInvoiceById } from '@/lib/db/invoices'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const invoice = await getInvoiceById(id, supabase).catch(() => null)

  if (!invoice) {
    redirect('/invoicing')
  }

  if (invoice.status !== 'draft') {
    redirect(`/invoicing/${invoice.id}?warning=edit-blocked`)
  }

  const [accounts, contacts, workstreams] = await Promise.all([
    getAccounts({}, supabase).catch(() => []),
    getContacts({}, supabase).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
  ])

  return (
    <InvoiceForm
      accounts={accounts}
      contacts={contacts}
      workstreams={workstreams}
      initialInvoice={invoice}
    />
  )
}
