import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'
import WorkspacePage from '@/components/workspace/workspace-page'

export default async function TasksPage({
  params,
}: {
  params: Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)

  return <WorkspacePage workspaceId={workspaceId} />
}
