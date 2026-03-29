import { notFound } from 'next/navigation'
import EnquiryDetailClient from '@/components/os/EnquiryDetailClient'
import { getAccounts } from '@/lib/db/accounts'
import { getEnquiryById } from '@/lib/db/enquiries'
import { createClient } from '@/lib/supabase/server'

export default async function EnquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [enquiry, quoteResult, accounts] = await Promise.all([
    getEnquiryById(id, supabase).catch(() => null),
    supabase
      .from('quotes')
      .select('id')
      .eq('enquiry_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getAccounts({}, supabase).catch(() => []),
  ])

  if (!enquiry) {
    notFound()
  }

  return (
    <EnquiryDetailClient
      initialEnquiry={enquiry}
      generatedQuoteId={quoteResult.data?.id ?? null}
      accounts={accounts}
    />
  )
}
