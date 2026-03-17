import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const status = request.nextUrl.searchParams.get('status')
  let query = auth.ctx.supabase.from('products').select('*').eq('workspace_id', workspaceId).order('name')
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ products: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.ctx.supabase.from('products').insert({
    workspace_id: workspaceId,
    name: body.name,
    sku: body.sku,
    brand: body.brand || null,
    category: body.category || null,
    description: body.description || null,
    unit_cost: body.unit_cost ?? null,
    unit_price: body.unit_price ?? null,
    weight_grams: body.weight_grams ?? null,
    status: body.status || 'draft',
    attributes: body.attributes || {},
    tags: body.tags || [],
    image_url: body.image_url || null,
    barcode: body.barcode || null,
    created_by: auth.ctx.userId,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ product: data }, { status: 201 })
}
