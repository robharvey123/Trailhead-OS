import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Resolve the CRM workspace for a given workspace.
 * Holding workspace → returns itself.
 * Brand workspace linked to a holding → returns the holding workspace.
 * No link found → falls back to current workspace.
 */
export async function getCrmWorkspaceId(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string> {
  const { data: ws } = await supabase
    .from('workspaces')
    .select('type')
    .eq('id', workspaceId)
    .single()

  if (ws?.type === 'holding') return workspaceId

  const { data: link } = await supabase
    .from('workspace_links')
    .select('workspace_id')
    .eq('linked_workspace_id', workspaceId)
    .maybeSingle()

  return link?.workspace_id || workspaceId
}

/**
 * Get the names of all brand workspaces linked to a holding workspace.
 */
export async function getLinkedBrandNames(
  supabase: SupabaseClient,
  holdingWorkspaceId: string
): Promise<string[]> {
  const { data: links } = await supabase
    .from('workspace_links')
    .select('linked_workspace_id')
    .eq('workspace_id', holdingWorkspaceId)

  if (!links?.length) return []

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('name')
    .in('id', links.map((l) => l.linked_workspace_id))
    .order('name')

  return workspaces?.map((w) => w.name) || []
}
