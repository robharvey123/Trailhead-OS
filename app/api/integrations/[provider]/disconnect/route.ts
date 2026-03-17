import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'
import { PROVIDERS, type IntegrationProvider } from '@/lib/integrations/types'

// POST /api/integrations/[provider]/disconnect
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  if (!PROVIDERS.includes(provider as IntegrationProvider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  const { workspace_id } = await req.json()
  const result = await getWorkspaceContext(workspace_id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  const { ctx } = result

  const { error } = await ctx.supabase
    .from('workspace_integrations')
    .update({
      status: 'disconnected',
      credentials: {},
      connected_at: null,
      connected_by: null,
    })
    .eq('workspace_id', ctx.workspaceId)
    .eq('provider', provider)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
