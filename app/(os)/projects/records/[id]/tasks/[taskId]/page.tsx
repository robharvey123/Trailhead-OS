import { notFound } from 'next/navigation'
import ProjectWorkspaceClient from '@/components/os/ProjectWorkspaceClient'
import { getProjectById } from '@/lib/db/projects'
import { createClient } from '@/lib/supabase/server'

export default async function ProjectTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>
}) {
  const { id, taskId } = await params
  const supabase = await createClient()
  const project = await getProjectById(id, supabase).catch(() => null)

  if (!project) {
    notFound()
  }

  return <ProjectWorkspaceClient project={project} initialTaskId={taskId} />
}