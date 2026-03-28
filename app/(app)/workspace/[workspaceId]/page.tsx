import { redirect } from 'next/navigation'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'

export default async function WorkspaceIndex({
  params,
}: {
  params: Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  redirect(`/analytics/${workspaceId}`)
}
