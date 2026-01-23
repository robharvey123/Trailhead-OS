import { redirect } from 'next/navigation'

export default function WorkspaceIndex({
  params,
}: {
  params: { workspaceId: string }
}) {
  redirect(`/workspace/${params.workspaceId}/dashboard`)
}
