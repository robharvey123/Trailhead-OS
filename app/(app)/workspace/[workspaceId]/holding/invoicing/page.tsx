import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import HoldingInvoicesClient from './HoldingInvoicesClient'

export default async function HoldingInvoicingPage({
  params,
}: {
  params: WorkspaceRouteParams | Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)

  return <HoldingInvoicesClient workspaceId={workspaceId} />
}
