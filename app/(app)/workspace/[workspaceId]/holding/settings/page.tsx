import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import SettingsClient from './SettingsClient'

export default async function SettingsPage({
  params,
}: {
  params: WorkspaceRouteParams | Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)

  return <SettingsClient workspaceId={workspaceId} />
}
