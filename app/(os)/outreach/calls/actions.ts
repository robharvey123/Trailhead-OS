'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Log a call outcome for a recipient: an activities row (the audit record) plus
 * the recipient's first-class call_status. `outcome` also drives do_not_call when
 * the caller marks the number as such.
 */
export async function logCallOutcome(formData: FormData): Promise<void> {
  const recipientId = String(formData.get('recipient_id') ?? '')
  const contactId = String(formData.get('contact_id') ?? '')
  const outcome = String(formData.get('outcome') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim() || null
  if (!recipientId || !contactId || !outcome) return

  const supabase = await createClient()

  await supabase.from('activities').insert({
    contact_id: contactId,
    type: 'Call',
    subject: outcome,
    notes,
    activity_date: new Date().toISOString(),
  })

  await supabase.from('outreach_recipients')
    .update({ call_status: outcome, call_last_at: new Date().toISOString() })
    .eq('id', recipientId)

  // Marking a number as not-to-be-called removes it from the queue for good.
  if (outcome === 'do_not_call') {
    await supabase.from('contacts').update({ do_not_call: true }).eq('id', contactId)
  }

  revalidatePath('/outreach/calls')
}
