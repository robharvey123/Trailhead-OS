import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace/auth'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace_id') || ''
  const auth = await getWorkspaceContext(workspaceId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { supabase } = auth.ctx

  const { data: invoices } = await supabase
    .from('finance_invoices')
    .select('invoice_number')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(200)

  let maxNum = 0
  for (const inv of invoices || []) {
    const match = inv.invoice_number.match(/^INV-(\d+)$/)
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10))
  }

  const nextNumber = `INV-${String(maxNum + 1).padStart(4, '0')}`
  return NextResponse.json({ next_number: nextNumber })
}
