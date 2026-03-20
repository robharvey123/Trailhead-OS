import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import ExpensesClient from './ExpensesClient'

export default async function ExpensesPage({
  params,
}: {
  params: WorkspaceRouteParams | Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)

  return <ExpensesClient workspaceId={workspaceId} />
}
