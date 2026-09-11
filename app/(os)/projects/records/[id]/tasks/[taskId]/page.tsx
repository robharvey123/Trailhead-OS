import { redirect } from 'next/navigation'

// The old ProjectWorkspaceClient / ProjectTaskPanel logged to the legacy
// task_time_logs table, outside every report. Task detail now lives at
// /my-work/[id], where the timer and time entries hit time_entries properly.
export default async function ProjectTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>
}) {
  const { id, taskId } = await params
  redirect(`/my-work/${taskId}?from=${encodeURIComponent(`/projects/records/${id}`)}`)
}
