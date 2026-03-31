import ProjectForm from '@/components/os/ProjectForm'
import { getAccounts } from '@/lib/db/accounts'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams?: Promise<{
    workstream_id?: string
    account_id?: string
    name?: string
    description?: string
    brief?: string
  }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const [workstreams, accounts] = await Promise.all([
    getWorkstreams(supabase).catch(() => []),
    getAccounts({}, supabase).catch(() => []),
  ])

  return (
    <ProjectForm
      workstreams={workstreams}
      accounts={accounts}
      initialValues={{
        workstream_id: resolvedSearchParams?.workstream_id,
        account_id: resolvedSearchParams?.account_id,
        name: resolvedSearchParams?.name,
        description: resolvedSearchParams?.description,
        brief: resolvedSearchParams?.brief,
      }}
    />
  )
}