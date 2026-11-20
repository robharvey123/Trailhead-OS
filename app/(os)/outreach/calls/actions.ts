'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Log a call outcome for a recipient: a `touchpoints` row of type 'call' (the
 * contact timeline record, the same table the sales seat and the MCP
 * log_call_outcome tool write) plus the recipient's first-class call_status.
 * `outcome` also drives do_not_call when the caller marks the number as such.
 *
 * This used to insert into `activities`, which nothing reads, so calls logged
 * here never reached the contact's timeline. Every write is now checked: a
 * failure throws to the OS error boundary instead of vanishing.
 */
export async function logCallOutcome(formData: FormData): Promise<void> {
  const recipientId = String(formData.get('recipient_id') ?? '')
  const contactId = String(formData.get('contact_id') ?? '')
  const outcome = String(formData.get('outcome') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim() || null
  if (!recipientId || !contactId || !outcome) return

  const supabase = await createClient()
  const now = new Date().toISOString()
  const label = outcome.replace(/_/g, ' ')

  const { error: touchpointError } = await supabase.from('touchpoints').insert({
    contact_id: contactId,
    type: 'call',
    subject: `Call: ${label.charAt(0).toUpperCase()}${label.slice(1)}`,
    body: notes,
    occurred_at: now,
  })
  if (touchpointError) throw new Error(`Could not log the call: ${touchpointError.message}`)

  const { error: recipientError } = await supabase
    .from('outreach_recipients')
    .update({ call_status: outcome, call_last_at: now })
    .eq('id', recipientId)
  if (recipientError) throw new Error(`Call logged, but the queue status did not update: ${recipientError.message}`)

  // Marking a number as not-to-be-called removes it from the queue for good.
  if (outcome === 'do_not_call') {
    const { error: dncError } = await supabase.from('contacts').update({ do_not_call: true }).eq('id', contactId)
    if (dncError) throw new Error(`Call logged, but do-not-call did not save: ${dncError.message}`)
  }

  revalidatePath('/outreach/calls')
  revalidatePath(`/crm/contacts/${contactId}`)
}
