import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'
import { getCrmWorkspaceId } from '@/lib/crm/workspace'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx
  const crmWorkspaceId = await getCrmWorkspaceId(supabase, workspaceId)
  const type = request.nextUrl.searchParams.get('type')

  let query = supabase
    .from('crm_accounts')
    .select('*')
    .eq('workspace_id', crmWorkspaceId)
    .order('name')

  if (type) query = query.eq('type', type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ accounts: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase, userId } = auth.ctx
  const crmWorkspaceId = await getCrmWorkspaceId(supabase, workspaceId)

  const { data, error } = await supabase
    .from('crm_accounts')
    .insert({
      workspace_id: crmWorkspaceId,
      name: body.name,
      type: body.type || 'customer',
      industry: body.industry || null,
      website: body.website || null,
      phone: body.phone || null,
      email: body.email || null,
      address_line1: body.address_line1 || null,
      address_line2: body.address_line2 || null,
      city: body.city || null,
      state: body.state || null,
      postal_code: body.postal_code || null,
      country: body.country || null,
      notes: body.notes || null,
      tags: body.tags || [],
      brands: body.brands || [],
      created_by: userId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ account: data }, { status: 201 })
}
