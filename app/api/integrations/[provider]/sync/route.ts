import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'
import { PROVIDERS, type IntegrationProvider } from '@/lib/integrations/types'
import { logSync } from '@/lib/integrations/sync'

// POST /api/integrations/[provider]/sync — trigger manual sync
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  if (!PROVIDERS.includes(provider as IntegrationProvider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  const { workspace_id } = await req.json()
  const result = await getWorkspaceContext(workspace_id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  const { ctx } = result

  // Get the integration record
  const { data: integration, error } = await ctx.supabase
    .from('workspace_integrations')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .eq('provider', provider)
    .single()

  if (error || !integration) {
    return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
  }

  if (integration.status !== 'connected') {
    return NextResponse.json({ error: 'Integration is not connected' }, { status: 422 })
  }

  // Provider-specific sync will be implemented per-connector.
  // For now, log a placeholder sync entry.
  await logSync({
    integrationId: integration.id,
    direction: 'inbound',
    entityType: 'manual_trigger',
    status: 'skipped',
    errorMessage: `${provider} sync not yet implemented`,
    recordsSynced: 0,
  })

  return NextResponse.json({ message: `${provider} sync triggered` })
}
