export type WorkspaceRouteParams = {
  workspaceId: string
}

export const resolveWorkspaceParams = async (
  params: WorkspaceRouteParams | Promise<WorkspaceRouteParams>
) => Promise.resolve(params)
