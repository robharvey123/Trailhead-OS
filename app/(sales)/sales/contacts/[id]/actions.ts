'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, roleCanUseSales } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { resend } from '@/lib/email/resend'
import { isSuppressed } from '@/lib/outreach/suppression'
import { getCompanySettings } from '@/lib/company-settings'
import { checkSenderAddress } from '@/lib/sales/sender'

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

const MAX_FOLLOW_UPS_PER_DAY = 40

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

/**
 * One-to-one follow-up email from the signed-in user's own sender identity.
 * Authorised with the user's client (RLS: the contact must be on their list),
 * then checked against do_not_email and the suppression list, sent through
 * Resend, logged as an email touchpoint and recorded in sales_follow_up_sends
 * so the webhook can attach delivered / opened / clicked.
 */
export async function sendFollowUpEmail(contactId: string, input: { subject: string; body: string }): Promise<ActionResult> {
  const supabase = await salesClient()
  if (!supabase) return { ok: false, error: 'You are not signed in to the sales seat.' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You are not signed in to the sales seat.' }

  const subject = (input.subject ?? '').trim()
  const body = (input.body ?? '').trim()
  if (!subject || subject.length > 200) return { ok: false, error: 'Add a subject (up to 200 characters).' }
  if (/[\r\n]/.test(subject)) return { ok: false, error: 'The subject cannot contain line breaks.' }
  if (!body || body.length > 10000) return { ok: false, error: 'Write the email (up to 10,000 characters).' }

  const { data: contact } = await supabase.from('contacts').select('id, name, email, do_not_email').eq('id', contactId).maybeSingle()
  if (!contact) return { ok: false, error: 'Contact not found in your list.' }
  if (!contact.email) return { ok: false, error: 'This contact has no email address.' }
  if (contact.do_not_email) return { ok: false, error: 'This contact has unsubscribed from email.' }

  const { data: identity } = await supabase.from('user_sender_identities').select('from_name, from_email, reply_to').eq('user_id', user.id).maybeSingle()
  if (!identity) return { ok: false, error: 'Set your sender identity in Sales settings first.' }

  const admin = createAdminClient()
  if (await isSuppressed(admin, contact.email)) return { ok: false, error: 'This address is on the suppression list (unsubscribed or bounced).' }
  const senderCheck = await checkSenderAddress(admin, identity.from_email)
  if (!senderCheck.ok) return { ok: false, error: `Your sender address can't be used: ${senderCheck.error}` }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await admin.from('sales_follow_up_sends').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('sent_at', since)
  if ((count ?? 0) >= MAX_FOLLOW_UPS_PER_DAY) return { ok: false, error: `Daily limit of ${MAX_FOLLOW_UPS_PER_DAY} follow-ups reached.` }

  if (!resend) return { ok: false, error: 'Email is not configured here.' }

  const settings = await getCompanySettings(admin)
  const html = [
    ...body.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`),
    '<hr style="border:none;border-top:1px solid #ddd;margin:24px 0 12px">',
    `<p style="font-size:12px;color:#666;margin:0">${escapeHtml(settings.company_name)}. Reply to this email if you would rather not hear from us again.</p>`,
  ].join('\n')

  const { data: sent, error: sendError } = await resend.emails.send({
    from: `${identity.from_name} <${identity.from_email}>`,
    to: contact.email,
    replyTo: identity.reply_to ?? identity.from_email,
    subject,
    html,
    text: `${body}\n\n--\n${settings.company_name}. Reply to this email if you would rather not hear from us again.`,
    tags: [{ name: 'kind', value: 'sales_follow_up' }],
  })
  if (sendError || !sent) return { ok: false, error: `Resend refused the email: ${sendError?.message ?? 'unknown error'}` }

  const { data: touchpoint } = await supabase
    .from('touchpoints')
    .insert({ contact_id: contactId, type: 'email', subject, body, occurred_at: new Date().toISOString() })
    .select('id')
    .single()

  await admin.from('sales_follow_up_sends').insert({
    contact_id: contactId,
    user_id: user.id,
    touchpoint_id: touchpoint?.id ?? null,
    resend_email_id: sent.id,
    to_email: contact.email,
    from_email: identity.from_email,
    subject,
    body_text: body,
  })

  revalidatePath(`/sales/contacts/${contactId}`)
  return { ok: true }
}
