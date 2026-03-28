import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import PaymentsClient from './PaymentsClient'

export default async function PaymentsPage({
  params,
}: {
  params: Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)

  return <PaymentsClient workspaceId={workspaceId} />
}
