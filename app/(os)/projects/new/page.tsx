import ProjectForm from '@/components/os/ProjectForm'
import { getAccounts } from '@/lib/db/accounts'
import { listEngagements } from '@/lib/db/engagements'
import { createClient } from '@/lib/supabase/server'

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams?: Promise<{
    account_id?: string
    engagement_id?: string
    name?: string
    description?: string
    brief?: string
  }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const [accounts, engagements] = await Promise.all([
    getAccounts({}, supabase).catch(() => []),
    listEngagements({ excludeTerminal: true }, supabase).catch(() => []),
  ])

  return (
    <ProjectForm
      accounts={accounts}
      engagements={engagements.map((e) => ({ id: e.id, name: e.name, status: e.status }))}
      initialValues={{
        account_id: resolvedSearchParams?.account_id,
        engagement_id: resolvedSearchParams?.engagement_id,
        name: resolvedSearchParams?.name,
        description: resolvedSearchParams?.description,
        brief: resolvedSearchParams?.brief,
      }}
    />
  )
}
