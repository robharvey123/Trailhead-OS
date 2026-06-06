import { notFound } from 'next/navigation'
import ProjectForm from '@/components/os/ProjectForm'
import { getAccounts } from '@/lib/db/accounts'
import { getProjectById } from '@/lib/db/projects'
import { listEngagements } from '@/lib/db/engagements'
import { createClient } from '@/lib/supabase/server'

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [project, accounts, engagements] = await Promise.all([
    getProjectById(id, supabase).catch(() => null),
    getAccounts({}, supabase).catch(() => []),
    listEngagements({ excludeTerminal: true }, supabase).catch(() => []),
  ])

  if (!project) {
    notFound()
  }

  // Ensure the currently-linked engagement is always selectable, even if it's
  // terminal (excludeTerminal would otherwise drop it and lose the preselection).
  const options = engagements.map((e) => ({ id: e.id, name: e.name, status: e.status }))
  if (project.engagement_id && !options.some((o) => o.id === project.engagement_id)) {
    const { data: current } = await supabase.from('engagements').select('id, name, status').eq('id', project.engagement_id).maybeSingle()
    if (current) options.unshift({ id: current.id, name: current.name, status: current.status })
  }

  return (
    <ProjectForm
      accounts={accounts}
      engagements={options}
      initialProject={project}
      cancelHref={`/projects/records/${project.id}`}
    />
  )
}