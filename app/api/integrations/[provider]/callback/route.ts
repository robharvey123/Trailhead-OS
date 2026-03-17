import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens } from '@/lib/integrations/oauth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PROVIDERS, type IntegrationProvider } from '@/lib/integrations/types'

// GET /api/integrations/[provider]/callback?code=...&state=...
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params
  if (!PROVIDERS.includes(provider as IntegrationProvider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  const code = req.nextUrl.searchParams.get('code')
  const stateRaw = req.nextUrl.searchParams.get('state')

  if (!code || !stateRaw) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
  }

  let state: { provider: string; workspaceId: string }
  try {
    state = JSON.parse(decodeURIComponent(stateRaw))
  } catch {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }

  if (state.provider !== provider) {
    return NextResponse.json({ error: 'State/provider mismatch' }, { status: 400 })
  }

  const redirectUri = `${req.nextUrl.origin}/api/integrations/${provider}/callback`

  try {
    const tokens = await exchangeCodeForTokens({
      provider: provider as IntegrationProvider,
      code,
      redirectUri,
    })

    // Store tokens using admin client (service role bypasses RLS)
    const supabase = createAdminClient()
    await supabase
      .from('workspace_integrations')
      .update({
        status: 'connected',
        credentials: tokens,
        connected_at: new Date().toISOString(),
      })
      .eq('workspace_id', state.workspaceId)
      .eq('provider', provider)

    // Redirect back to integrations settings
    return NextResponse.redirect(
      new URL(`/workspace/${state.workspaceId}/settings/integrations?connected=${provider}`, req.nextUrl.origin)
    )
  } catch (err) {
    const supabase = createAdminClient()
    await supabase
      .from('workspace_integrations')
      .update({ status: 'error' })
      .eq('workspace_id', state.workspaceId)
      .eq('provider', provider)

    return NextResponse.redirect(
      new URL(`/workspace/${state.workspaceId}/settings/integrations?error=${provider}`, req.nextUrl.origin)
    )
  }
}
