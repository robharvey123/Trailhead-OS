import InvoiceForm from '@/components/os/InvoiceForm'
import { getContacts } from '@/lib/db/contacts'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export default async function NewInvoicePage() {
  const supabase = await createClient()
  const [contacts, workstreams] = await Promise.all([
    getContacts({}, supabase).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
  ])

  return <InvoiceForm contacts={contacts} workstreams={workstreams} />
}
