import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const q = (request.nextUrl.searchParams.get('q') || '').trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { supabase } = auth.ctx

  const pattern = `%${q}%`

  const [accounts, contacts, deals, invoices, tasks] = await Promise.all([
    supabase.from('crm_accounts').select('id, name, type').eq('workspace_id', workspaceId).ilike('name', pattern).limit(5),
    supabase.from('crm_contacts').select('id, first_name, last_name, email').eq('workspace_id', workspaceId).or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`).limit(5),
    supabase.from('crm_deals').select('id, title, stage').eq('workspace_id', workspaceId).ilike('title', pattern).limit(5),
    supabase.from('finance_invoices').select('id, invoice_number, status, total').eq('workspace_id', workspaceId).ilike('invoice_number', pattern).limit(5),
    supabase.from('workspace_tasks').select('id, title, status').eq('workspace_id', workspaceId).ilike('title', pattern).limit(5),
  ])

  return NextResponse.json({
    results: {
      accounts: (accounts.data || []).map((a) => ({ id: a.id, label: a.name, sub: a.type, module: 'accounts' })),
      contacts: (contacts.data || []).map((c) => ({ id: c.id, label: `${c.first_name} ${c.last_name}`, sub: c.email, module: 'contacts' })),
      deals: (deals.data || []).map((d) => ({ id: d.id, label: d.title, sub: d.stage, module: 'deals' })),
      invoices: (invoices.data || []).map((i) => ({ id: i.id, label: i.invoice_number, sub: i.status, module: 'invoices' })),
      tasks: (tasks.data || []).map((t) => ({ id: t.id, label: t.title, sub: t.status, module: 'tasks' })),
    },
  })
}
