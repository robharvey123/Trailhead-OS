'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type CreateWorkspaceState = {
  error?: string
  success?: boolean
}

export async function createWorkspace(
  _prevState: CreateWorkspaceState,
  formData: FormData
): Promise<CreateWorkspaceState> {
  const name = String(formData.get('name') ?? '').trim()

  if (!name) {
    return { error: 'Workspace name is required.' }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be signed in to create a workspace.' }
  }

  const admin = createAdminClient()
  const { data: workspace, error: workspaceError } = await admin
    .from('workspaces')
    .insert({ name, owner_user_id: user.id })
    .select('id')
    .single()

  if (workspaceError || !workspace) {
    return { error: workspaceError?.message ?? 'Failed to create workspace.' }
  }

  const workspaceId = workspace.id

  const { error: memberError } = await admin.from('workspace_members').insert({
    workspace_id: workspaceId,
    user_id: user.id,
    role: 'owner',
  })

  if (memberError) {
    return { error: memberError.message }
  }

  const { error: settingsError } = await admin
    .from('workspace_settings')
    .insert({ workspace_id: workspaceId })

  if (settingsError) {
    return { error: settingsError.message }
  }

  revalidatePath('/workspaces')
  return { success: true }
}
