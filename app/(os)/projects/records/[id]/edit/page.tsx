import { notFound } from 'next/navigation'
import ProjectForm from '@/components/os/ProjectForm'
import { getAccounts } from '@/lib/db/accounts'
import { getProjectById } from '@/lib/db/projects'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [project, workstreams, accounts] = await Promise.all([
    getProjectById(id, supabase).catch(() => null),
    getWorkstreams(supabase).catch(() => []),
    getAccounts({}, supabase).catch(() => []),
  ])

  if (!project) {
    notFound()
  }

  return (
    <ProjectForm
      workstreams={workstreams}
      accounts={accounts}
      initialProject={project}
      cancelHref={`/projects/records/${project.id}`}
    />
  )
}