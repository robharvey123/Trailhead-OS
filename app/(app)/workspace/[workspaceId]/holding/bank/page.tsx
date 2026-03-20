import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import BankClient from './BankClient'

export default async function BankPage({
  params,
}: {
  params: WorkspaceRouteParams | Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)

  return <BankClient workspaceId={workspaceId} />
}
