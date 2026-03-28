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
  const workstream =
    workstreams.find((item) => item.id === invoice.workstream_id) ?? null

  return (
    <InvoiceDetailClient
      invoice={invoice}
      contact={contact}
      workstream={workstream}
      warning={resolvedSearchParams?.warning ?? null}
    />
  )
}
