import { notFound } from 'next/navigation'
import InvoiceDetailClient from '@/components/os/InvoiceDetailClient'
import { getAccountById } from '@/lib/db/accounts'
import { getContactById } from '@/lib/db/contacts'
import { getInvoiceById } from '@/lib/db/invoices'
import { listPayments } from '@/lib/db/invoice-payments'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, roleIsAdmin } from '@/lib/auth/roles'

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ warning?: string }>
}) {
  const { id } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const invoice = await getInvoiceById(id, supabase).catch(() => null)

  if (!invoice) {
    notFound()
  }

  const [contact, account, workstreams, payments] = await Promise.all([
    invoice.contact_id ? getContactById(invoice.contact_id, supabase).catch(() => null) : null,
    invoice.account_id ? getAccountById(invoice.account_id, supabase).catch(() => null) : null,
    getWorkstreams(supabase).catch(() => []),
    listPayments(id, supabase).catch(() => []),
  ])
  const stripeCustomerResult = invoice.account_id
    ? await supabase
        .from('stripe_customers')
        .select('subscription_status')
        .eq('account_id', invoice.account_id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }
  const workstream =
    workstreams.find((item) => item.id === invoice.workstream_id) ?? null
  const profile = await getCurrentProfile(supabase).catch(() => null)
  const isAdmin = roleIsAdmin(profile?.role)

  return (
    <InvoiceDetailClient
      invoice={invoice}
      contact={contact}
      account={account}
      payments={payments}
      workstream={workstream}
      subscriptionStatus={stripeCustomerResult.data?.subscription_status ?? null}
      warning={resolvedSearchParams?.warning ?? null}
      isAdmin={isAdmin}
    />
  )
}
