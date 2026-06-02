import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getMilestone, markMilestoneInvoiced } from '@/lib/db/tier1'
import { createInvoice } from '@/lib/db/invoices'
import { NextRequest, NextResponse } from 'next/server'

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

// POST — raise the performance-fee invoice for a completed milestone.
// Recipient = engagement.billed_via account (falls back to end client), with the
// end client noted. Links the invoice back via tier1_milestones.fee_invoice_id.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params

    const milestone = await getMilestone(id, supabase)
    if (!milestone) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
    if (!milestone.is_complete) return NextResponse.json({ error: 'Milestone is not complete' }, { status: 400 })
    if (milestone.fee_invoice_id) return NextResponse.json({ error: 'Already invoiced' }, { status: 400 })

    const { data: engagement, error: engErr } = await supabase
      .from('engagements')
      .select('id, name, currency, end_client_account_id, billed_via_account_id, end_client:accounts!end_client_account_id(name), billed_via:accounts!billed_via_account_id(name)')
      .eq('id', milestone.engagement_id)
      .single()
    if (engErr || !engagement) return NextResponse.json({ error: 'Engagement not found' }, { status: 404 })

    const eng = engagement as unknown as {
      name: string
      end_client_account_id: string
      billed_via_account_id: string | null
      end_client?: { name: string } | null
      billed_via?: { name: string } | null
    }
    const recipientAccountId = eng.billed_via_account_id ?? eng.end_client_account_id
    const recipientName = eng.billed_via?.name ?? eng.end_client?.name ?? null
    const endClientName = eng.end_client?.name ?? 'end client'
    const fee = milestone.performance_fee ?? 0

    const today = new Date()
    const due = new Date(today)
    due.setDate(due.getDate() + 30)

    const invoice = await createInvoice(
      {
        account_id: recipientAccountId,
        contact_id: null,
        workstream_id: null,
        status: 'draft',
        issue_date: isoDate(today),
        due_date: isoDate(due),
        line_items: [
          {
            id: crypto.randomUUID(),
            description: `Performance fee — Tier 1 listing: ${milestone.account?.name ?? 'account'} (${eng.name})`,
            qty: 1,
            unit_price: fee,
          },
        ],
        vat_rate: 0,
        bill_to_name: recipientName,
        bill_to_address: null,
        bill_to_city: null,
        bill_to_postcode: null,
        bill_to_country: null,
        bill_to_email: null,
        bill_to_phone: null,
        notes: `Performance fee for confirmed Tier 1 listing. End client: ${endClientName}.`,
      },
      supabase
    )

    await markMilestoneInvoiced(id, invoice.id, supabase)
    return NextResponse.json({ invoice }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to raise invoice' }, { status: 500 })
  }
}
