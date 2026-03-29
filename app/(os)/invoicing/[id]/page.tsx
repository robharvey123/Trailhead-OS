import { notFound } from 'next/navigation'
import InvoiceDetailClient from '@/components/os/InvoiceDetailClient'
import { getContactById } from '@/lib/db/contacts'
import { getInvoiceById } from '@/lib/db/invoices'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

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

  const [contact, workstreams] = await Promise.all([
    invoice.contact_id ? getContactById(invoice.contact_id, supabase).catch(() => null) : null,
    getWorkstreams(supabase).catch(() => []),
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

  return (
    <InvoiceDetailClient
      invoice={invoice}
      contact={contact}
      workstream={workstream}
      subscriptionStatus={stripeCustomerResult.data?.subscription_status ?? null}
      warning={resolvedSearchParams?.warning ?? null}
    />
  )
}
