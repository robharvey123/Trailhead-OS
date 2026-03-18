import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import LaunchesClient from './LaunchesClient'

export default async function LaunchesPage({ params }: { params: WorkspaceRouteParams | Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const [launchesRes, productsRes] = await Promise.all([
    supabase.from('product_launches').select('*, products(name)').eq('workspace_id', workspaceId).order('launch_date', { ascending: false }),
    supabase.from('products').select('id, name').eq('workspace_id', workspaceId).order('name'),
  ])

  const launches = (launchesRes.data || []).map((d: Record<string, unknown>) => ({ ...d, product_name: (d.products as { name: string } | null)?.name || null })) as unknown as import('@/lib/products/types').ProductLaunch[]

  return <LaunchesClient workspaceId={workspaceId} initialLaunches={launches} products={productsRes.data || []} />
}
