import ImportClient from './ImportClient'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'

export default async function ImportsPage({
  params,
}: {
  params: WorkspaceRouteParams | Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  return <ImportClient workspaceId={workspaceId} />
}
