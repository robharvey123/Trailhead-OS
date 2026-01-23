import ImportClient from './ImportClient'

export default function ImportsPage({
  params,
}: {
  params: { workspaceId: string }
}) {
  return <ImportClient workspaceId={params.workspaceId} />
}
