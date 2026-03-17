import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'
import { providerRegistry } from '@/lib/integrations/registry'
import { buildAuthUrl } from '@/lib/integrations/oauth'
import { PROVIDERS, type IntegrationProvider } from '@/lib/integrations/types'

// GET /api/integrations?workspace_id=...
export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get('workspace_id')
  const result = await getWorkspaceContext(workspaceId ?? '')
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  const { ctx } = result

  const { data, error } = await ctx.supabase
    .from('workspace_integrations')
    .select('id, workspace_id, provider, status, config, connected_at, connected_by, created_at, updated_at')
    .eq('workspace_id', ctx.workspaceId)
    .order('provider')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Merge with registry to include unconnected providers
  const connected = new Map((data ?? []).map((i) => [i.provider, i]))
  const integrations = PROVIDERS.map((p) => ({
    ...providerRegistry[p],
    provider: p,
    integration: connected.get(p) ?? null,
  }))

  return NextResponse.json({ integrations })
}

// POST /api/integrations — initiate a connection
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { workspace_id, provider, api_key } = body as { workspace_id: string; provider: string; api_key?: string }

  if (!PROVIDERS.includes(provider as IntegrationProvider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  const result = await getWorkspaceContext(workspace_id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  const { ctx } = result

  const cfg = providerRegistry[provider as IntegrationProvider]

  // API-key providers: store immediately
  if (cfg.authType === 'api_key') {
    if (!api_key) return NextResponse.json({ error: 'api_key is required' }, { status: 400 })

    const { data, error } = await ctx.supabase
      .from('workspace_integrations')
      .upsert({
        workspace_id: ctx.workspaceId,
        provider,
        status: 'connected',
        credentials: { api_key },
        connected_at: new Date().toISOString(),
        connected_by: ctx.userId,
      }, { onConflict: 'workspace_id,provider' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ integration: data })
  }

  // OAuth providers: return auth URL
  const origin = req.nextUrl.origin
  const redirectUri = `${origin}/api/integrations/${provider}/callback`
  const authUrl = buildAuthUrl({ provider: provider as IntegrationProvider, workspaceId: ctx.workspaceId, redirectUri })

  if (!authUrl) return NextResponse.json({ error: `OAuth not configured for ${provider}` }, { status: 422 })

  // Ensure a row exists so the callback can upsert
  await ctx.supabase
    .from('workspace_integrations')
    .upsert({
      workspace_id: ctx.workspaceId,
      provider,
      status: 'disconnected',
    }, { onConflict: 'workspace_id,provider' })

  return NextResponse.json({ auth_url: authUrl })
}
