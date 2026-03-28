import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import StreamsClient from './StreamsClient'

export default async function StreamsPage({
  params,
}: {
  params: Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)

  return <StreamsClient workspaceId={workspaceId} />
}
