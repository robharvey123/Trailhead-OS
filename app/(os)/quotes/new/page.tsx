import QuoteForm from '@/components/os/QuoteForm'
import { getAccounts } from '@/lib/db/accounts'
import { getContacts } from '@/lib/db/contacts'
import { getProjectById, getProjects } from '@/lib/db/projects'
import type { ProjectPhase } from '@/lib/types'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

function mapProjectPhasesToScope(phases: ProjectPhase[] | undefined) {
  return (phases ?? []).map((phase) => ({
    phase: phase.name,
    description: phase.description ?? 'Details to be confirmed.',
    deliverables: [],
    duration:
      phase.start_date && phase.end_date
        ? `${phase.start_date} to ${phase.end_date}`
        : 'TBC',
  }))
}

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams?: Promise<{
    account_id?: string
    enquiry_id?: string
    pricing_tier_id?: string
    project_id?: string
  }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const selectedProjectId = resolvedSearchParams?.project_id ?? ''
  const [accounts, contacts, workstreams, projects, selectedProject] = await Promise.all([
    getAccounts({}, supabase).catch(() => []),
    getContacts({}, supabase).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
    getProjects({}, supabase).catch(() => []),
    selectedProjectId ? getProjectById(selectedProjectId, supabase).catch(() => null) : Promise.resolve(null),
  ])

  return (
    <QuoteForm
      accounts={accounts}
      contacts={contacts}
      workstreams={workstreams}
      projects={projects}
      initialAccountId={resolvedSearchParams?.account_id ?? ''}
      initialEnquiryId={resolvedSearchParams?.enquiry_id ?? ''}
      initialPricingTierId={resolvedSearchParams?.pricing_tier_id ?? ''}
      initialProjectId={selectedProjectId}
      initialProjectScope={mapProjectPhasesToScope(selectedProject?.phases)}
    />
  )
}
