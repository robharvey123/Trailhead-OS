import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import InventoryClient from './InventoryClient'

export default async function InventoryPage({ params }: { params: WorkspaceRouteParams | Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const [invRes, productsRes] = await Promise.all([
    supabase.from('inventory').select('*, products(name, sku)').eq('workspace_id', workspaceId).order('warehouse'),
    supabase.from('products').select('id, name, sku').eq('workspace_id', workspaceId).order('name'),
  ])

  const inventory = (invRes.data || []).map((d: Record<string, unknown>) => {
    const prod = d.products as { name: string; sku: string } | null
    return { ...d, product_name: prod?.name || null, product_sku: prod?.sku || null }
  })

  return <InventoryClient workspaceId={workspaceId} initialInventory={inventory} products={productsRes.data || []} />
}
