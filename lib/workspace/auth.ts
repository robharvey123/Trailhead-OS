import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type WorkspaceContext = {
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>
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

  const headersList = await headers()
  const isApiKeyAuth = headersList.get('x-api-key-verified') === 'true'

  if (isApiKeyAuth) {
    const supabase = createAdminClient()
    const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
    const user = users[0] ?? null
    if (!user) {
      return { ok: false, status: 500, error: 'No user found' }
    }
    return { ok: true, ctx: { supabase, userId: user.id, workspaceId } }
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
