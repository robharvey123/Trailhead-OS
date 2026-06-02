import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getApproval, setApprovalThread } from '@/lib/db/approvals'
import { sendEmail } from '@/lib/google/gmail'
import { APPROVAL_TYPE_LABELS } from '@/lib/types'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase, user } = await getAuthenticatedSupabase()
    if (!ok) return authResponse
    const { id } = await params

    const approval = await getApproval(id, supabase)
    if (!approval) return NextResponse.json({ error: 'Approval not found' }, { status: 404 })

    const { data: eng } = await supabase
      .from('engagements')
      .select('name, currency, billed_via_account_id, end_client:accounts!end_client_account_id(name)')
      .eq('id', approval.engagement_id)
      .single()
    const engagement = eng as unknown as { name: string; currency: string; billed_via_account_id: string | null; end_client?: { name: string } | null } | null

    // Recipient: explicit approver, else a contact at the billed-via account.
    let to = approval.approver?.email ?? null
    if (!to && engagement?.billed_via_account_id) {
      const { data: c } = await supabase.from('contacts').select('email').eq('account_id', engagement.billed_via_account_id).not('email', 'is', null).limit(1).maybeSingle()
      to = c?.email ?? null
    }
    if (!to) return NextResponse.json({ error: 'No approver email — set an approver contact or add a contact at the billed-via account.' }, { status: 400 })

    const typeLabel = APPROVAL_TYPE_LABELS[approval.type]
    const amount = approval.amount != null ? `${approval.currency} ${approval.amount.toFixed(2)}` : 'N/A'
    const subject = `Approval request — ${typeLabel} · ${engagement?.name ?? 'engagement'}`
    const body = [
      `<p>Hi,</p>`,
      `<p>Requesting approval on <strong>${engagement?.name ?? ''}</strong>${engagement?.end_client ? ` (end client: ${engagement.end_client.name})` : ''}.</p>`,
      `<ul><li><strong>Type:</strong> ${typeLabel}</li><li><strong>Amount:</strong> ${amount}</li>${approval.description ? `<li><strong>Detail:</strong> ${approval.description}</li>` : ''}</ul>`,
      `<p><strong>Reply YES to approve, or NO to decline.</strong></p>`,
      `<p>Thanks.</p>`,
    ].join('\n')

    const res = await sendEmail({ to, subject, body })
    const threadId = res.data.threadId ?? null
    if (threadId) await setApprovalThread(id, threadId, supabase)

    await supabase.from('email_logs').insert({
      gmail_message_id: res.data.id ?? null,
      gmail_thread_id: threadId,
      account_id: engagement?.billed_via_account_id ?? null,
      contact_id: approval.approver_id ?? null,
      direction: 'outbound',
      from_address: user.email ?? '',
      to_addresses: [to],
      subject,
      snippet: `Approval request — ${typeLabel}`,
      body_html: body,
      sent_at: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, thread_id: threadId })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to send approval request' }, { status: 500 })
  }
}
