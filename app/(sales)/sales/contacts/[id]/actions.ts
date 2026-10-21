'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, roleCanUseSales } from '@/lib/auth/roles'

export type ActionResult = { ok: true } | { ok: false; error: string }

const MAX_NOTE = 4000

async function salesClient() {
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase).catch(() => null)
  if (!profile || !roleCanUseSales(profile.role)) return null
  return supabase
}

/** Add a note to a contact's timeline (a touchpoint of type 'note'). */
export async function addContactNote(contactId: string, text: string): Promise<ActionResult> {
  const supabase = await salesClient()
  if (!supabase) return { ok: false, error: 'You are not signed in to the sales seat.' }
  const body = (text ?? '').trim()
  if (!body) return { ok: false, error: 'Write a note first.' }
  if (body.length > MAX_NOTE) return { ok: false, error: `Notes are limited to ${MAX_NOTE} characters.` }

  const { error } = await supabase.from('touchpoints').insert({
    contact_id: contactId,
    type: 'note',
    subject: 'Note',
    body,
    occurred_at: new Date().toISOString(),
  })
  if (error) return { ok: false, error: 'Could not save the note. The contact may be outside your list.' }
  revalidatePath(`/sales/contacts/${contactId}`)
  return { ok: true }
}

/**
 * Mark a contact unsubscribed: do_not_email on the contact (the send engine
 * checks it before every send) plus an email suppression, and a timeline note.
 * Also removes them from every call queue (the shared eligibility rule).
 */
export async function markContactUnsubscribed(contactId: string): Promise<ActionResult> {
  const supabase = await salesClient()
  if (!supabase) return { ok: false, error: 'You are not signed in to the sales seat.' }

  const { data: contact } = await supabase.from('contacts').select('id, email, do_not_email').eq('id', contactId).maybeSingle()
  if (!contact) return { ok: false, error: 'Contact not found in your list.' }

  if (!contact.do_not_email) {
    const { error } = await supabase.from('contacts').update({ do_not_email: true }).eq('id', contactId)
    if (error) return { ok: false, error: 'Could not mark this contact unsubscribed.' }
  }
  if (contact.email) {
    const { error } = await supabase
      .from('email_suppressions')
      .insert({ email: contact.email, reason: 'unsubscribed', source: 'sales_seat' })
    // 23505 = already suppressed, which is the outcome we want.
    if (error && error.code !== '23505') return { ok: false, error: 'Marked do-not-email, but the suppression did not save. Tell Rob.' }
  }
  await supabase.from('touchpoints').insert({
    contact_id: contactId,
    type: 'note',
    subject: 'Marked unsubscribed',
    body: 'Asked not to be contacted by email. Removed from campaign sends and the call queue.',
    occurred_at: new Date().toISOString(),
  })
  revalidatePath(`/sales/contacts/${contactId}`)
  revalidatePath('/sales/contacts')
  return { ok: true }
}
