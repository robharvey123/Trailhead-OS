import { notFound } from 'next/navigation'
import WorkstreamBoardClient from '@/components/os/WorkstreamBoardClient'
import { getColumnsByWorkstream } from '@/lib/db/columns'
import { listProjectsByWorkstream } from '@/lib/db/projects'
import { getTasks } from '@/lib/db/tasks'
import { getWorkstreamBySlug, getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export default async function WorkstreamBoardPage({
  params,
}: {
  params: Promise<{ workstream: string }>
}) {
  const { workstream: workstreamSlug } = await params
  const supabase = await createClient()
  const workstream = await getWorkstreamBySlug(workstreamSlug, supabase).catch(() => null)

  if (!workstream) {
    notFound()
  }

  const [workstreams, columns, tasks, projects] = await Promise.all([
    getWorkstreams(supabase).catch(() => []),
    getColumnsByWorkstream(workstream.id, supabase).catch(() => []),
    getTasks({ workstream_id: workstream.id }, supabase).catch(() => []),
    listProjectsByWorkstream(workstream.id, supabase).catch(() => []),
  ])

  return (
    <WorkstreamBoardClient
      workstream={workstream}
      workstreams={workstreams}
      columns={columns}
      initialTasks={tasks}
      projects={projects}
    />
  )
}
