import { notFound } from 'next/navigation'
import ProjectDetail from '@/components/os/ProjectDetail'
import { getProjectById } from '@/lib/db/projects'
import { createClient } from '@/lib/supabase/server'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const project = await getProjectById(id, supabase).catch(() => null)

  if (!project) {
    notFound()
  }

  return <ProjectDetail project={project} />
}