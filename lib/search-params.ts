export type WorkspaceSearchParams = {
  brand?: string
  start?: string
  end?: string
}

export const resolveSearchParams = async (
  searchParams: WorkspaceSearchParams | Promise<WorkspaceSearchParams>
) => Promise.resolve(searchParams)
