import { createAdminClient } from '@/lib/supabase/admin'

export async function sendInvoicePaidNotification(invoiceId: string, invoiceNumber: string) {
  const admin = createAdminClient()
  const { data: members } = await admin
    .from('workspace_members')
    .select('workspace_id, user_id')
    .limit(10)

  if (!members?.length) {
    return
  }

  await admin.from('notifications').insert(
    members.map(member => ({
      workspace_id: member.workspace_id,
      user_id: member.user_id,
      type: 'invoice',
      title: `Invoice paid - ${invoiceNumber}`,
      body: `Invoice ${invoiceNumber} has been paid.`,
      link: `/invoicing/${invoiceId}`,
    }))
  )
}
