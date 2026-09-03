import InvoiceForm from '@/components/os/InvoiceForm'
import { getAccounts } from '@/lib/db/accounts'
import { getContacts } from '@/lib/db/contacts'
import { getWorkstreams } from '@/lib/db/workstreams'
import { getCompanySettings } from '@/lib/company-settings'
import { createClient } from '@/lib/supabase/server'

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams?: Promise<{ account_id?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const [accounts, contacts, workstreams, companySettings] = await Promise.all([
    getAccounts({}, supabase).catch(() => []),
    getContacts({}, supabase).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
    getCompanySettings(supabase).catch(() => null),
  ])

  return (
    <InvoiceForm
      accounts={accounts}
      contacts={contacts}
      workstreams={workstreams}
      initialAccountId={resolvedSearchParams?.account_id ?? ''}
      vatRegistered={companySettings?.vat_registered ?? false}
      defaultPaymentTermsDays={companySettings?.default_payment_terms_days ?? 14}
    />
  )
}
