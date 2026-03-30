import { createClient } from '@/lib/supabase/server'

export type WorkspaceContext = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  workspaceId: string
}

export async function getWorkspaceContext(
  workspaceId: string
): Promise<
  | { ok: true; ctx: WorkspaceContext }
  | { ok: false; status: number; error: string }
> {
  if (!workspaceId) {
    return { ok: false, status: 400, error: 'workspace_id is required' }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) {
    return { ok: false, status: 403, error: 'Workspace access denied' }
  }

  return {
    ok: true,
    ctx: {
      supabase,
      userId: user.id,
      workspaceId,
    },
  }
}
