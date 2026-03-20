import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import CommissionClient from './CommissionClient'

export default async function CommissionPage({
  params,
}: {
  params: WorkspaceRouteParams | Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)

  return <CommissionClient workspaceId={workspaceId} />
}
