import { notFound } from 'next/navigation'
import EnquiryDetailClient from '@/components/os/EnquiryDetailClient'
import { getAccounts } from '@/lib/db/accounts'
import { getEnquiryById } from '@/lib/db/enquiries'
import { getProjectById, getProjects } from '@/lib/db/projects'
import { createClient } from '@/lib/supabase/server'

export default async function EnquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [enquiry, quoteResult, accounts, projects] = await Promise.all([
    getEnquiryById(id, supabase).catch(() => null),
    supabase
      .from('quotes')
      .select('id')
      .eq('enquiry_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getAccounts({}, supabase).catch(() => []),
    getProjects({}, supabase).catch(() => []),
  ])

  if (!enquiry) {
    notFound()
  }

  const linkedProject = enquiry.project_id
    ? await getProjectById(enquiry.project_id, supabase).catch(() => null)
    : null

  return (
    <EnquiryDetailClient
      initialEnquiry={enquiry}
      generatedQuoteId={quoteResult.data?.id ?? null}
      accounts={accounts}
      projects={projects}
      linkedProject={linkedProject}
    />
  )
}
