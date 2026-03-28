import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import HoldingDashboard from './HoldingDashboard'

export default async function HoldingPage({
  params,
}: {
  params: Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)

  return <HoldingDashboard workspaceId={workspaceId} />
}
