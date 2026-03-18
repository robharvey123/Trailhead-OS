import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx

  let query = supabase
    .from('crm_activities')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('activity_date', { ascending: false })
    .limit(100)

  const accountId = request.nextUrl.searchParams.get('account_id')
  const contactId = request.nextUrl.searchParams.get('contact_id')
  const dealId = request.nextUrl.searchParams.get('deal_id')
  if (accountId) query = query.eq('account_id', accountId)
  if (contactId) query = query.eq('contact_id', contactId)
  if (dealId) query = query.eq('deal_id', dealId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ activities: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const workspaceId = body.workspace_id || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase, userId } = auth.ctx

  const { data, error } = await supabase
    .from('crm_activities')
    .insert({
      workspace_id: workspaceId,
      account_id: body.account_id || null,
      contact_id: body.contact_id || null,
      deal_id: body.deal_id || null,
      type: body.type || 'note',
      subject: body.subject,
      body: body.body || null,
      activity_date: body.activity_date || new Date().toISOString().slice(0, 10),
      created_by: userId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activity: data }, { status: 201 })
}
