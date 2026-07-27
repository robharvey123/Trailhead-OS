import { randomUUID } from 'node:crypto'
import { supabaseService } from '@/lib/supabase/service'
import { resend } from '@/lib/email/resend'
import { getCompanySettings } from '@/lib/company-settings'
import { renderTemplate } from './render'
import { renderOutreachFooterHtml } from './footer'
import { isSuppressed } from './suppression'
import type { Contact, OutreachCampaign, OutreachCampaignStep, OutreachRecipient, OutreachTemplate } from '@/lib/types'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trailheadholdings.uk').replace(/\/$/, '')

export type SendSkipReason = 'suppressed' | 'do_not_email' | 'already_claimed'

export type SendResult =
  | { ok: true; sendId: string; resendId: string | null }
  | { ok: false; skipped: true; reason: SendSkipReason }
  | { ok: false; error: string; kind?: 'render' }

/** Merge vars for one contact — always all seven keys so render() never throws on a missing key. */
export function contactVars(contact: Pick<Contact, 'email_greeting' | 'company' | 'name' | 'city' | 'channel' | 'sub_trade' | 'size_signal'>): Record<string, string> {
  return {
    email_greeting: (contact.email_greeting ?? '').trim() || 'there',
    company: contact.company ?? '',
    name: contact.name ?? '',
    city: contact.city ?? '',
    channel: contact.channel ?? '',
    sub_trade: contact.sub_trade ?? '',
    size_signal: contact.size_signal ?? '',
  }
}

/**
 * Send the current step's email for one recipient through Resend, from the
 * campaign's own identity. The outreach_sends row is inserted BEFORE the Resend
 * call and is guarded by unique(recipient_id, step_id), so a concurrent tick (or
 * a retry after a lost response) can't double-deliver a step. Refuses to send
 * when the address is suppressed or the contact is do_not_email.
 */
export async function sendCampaignEmail({ recipientId }: { recipientId: string }): Promise<SendResult> {
  if (!resend) return { ok: false, error: 'RESEND_API_KEY is not configured' }
  const db = supabaseService

  const { data: recipient } = await db.from('outreach_recipients').select('*').eq('id', recipientId).maybeSingle<OutreachRecipient>()
  if (!recipient) return { ok: false, error: 'Recipient not found' }

  const { data: contact } = await db.from('contacts').select('*').eq('id', recipient.contact_id).maybeSingle<Contact>()
  if (!contact || !contact.email) return { ok: false, error: 'Contact has no email' }
  const email = contact.email.trim()

  const { data: campaign } = await db.from('outreach_campaigns').select('*').eq('id', recipient.campaign_id).maybeSingle<OutreachCampaign>()
  if (!campaign || !campaign.from_email) return { ok: false, error: 'Campaign missing sending identity' }

  // Compliance guards — refuse rather than send (suppression fails closed).
  if (contact.do_not_email) return { ok: false, skipped: true, reason: 'do_not_email' }
  if (await isSuppressed(db, email)) return { ok: false, skipped: true, reason: 'suppressed' }

  // Current step (0-indexed into the ordered list) + its template, honouring a
  // per-channel override so one campaign can do sector-tailored first touches.
  const { data: steps } = await db.from('outreach_campaign_steps').select('*').eq('campaign_id', campaign.id).order('step_number', { ascending: true })
  const step = ((steps ?? []) as OutreachCampaignStep[])[recipient.current_step]
  if (!step) return { ok: false, error: `No step at index ${recipient.current_step}` }

  let templateId = step.template_id
  if (contact.channel) {
    const { data: override } = await db.from('outreach_step_template_overrides').select('template_id').eq('step_id', step.id).eq('channel', contact.channel).maybeSingle<{ template_id: string }>()
    if (override) templateId = override.template_id
  }
  const { data: template } = await db.from('outreach_templates').select('*').eq('id', templateId ?? '').maybeSingle<OutreachTemplate>()
  if (!template) return { ok: false, error: 'Template not found' }

  // Claim the (recipient, step) slot by inserting the send row first. The unique
  // index makes this the exclusive claim: a concurrent tick gets 23505.
  let sendRowId: string
  const { data: claim, error: claimErr } = await db
    .from('outreach_sends')
    .insert({ campaign_id: campaign.id, recipient_id: recipient.id, step_id: step.id, status: 'queued' })
    .select('id')
    .single()
  if (claimErr) {
    if (claimErr.code === '23505') {
      // Slot already exists — only re-send if the prior attempt genuinely failed.
      const { data: existing } = await db.from('outreach_sends').select('id, status').eq('recipient_id', recipient.id).eq('step_id', step.id).maybeSingle<{ id: string; status: string }>()
      if (!existing || existing.status !== 'failed') return { ok: false, skipped: true, reason: 'already_claimed' }
      sendRowId = existing.id
    } else {
      return { ok: false, error: claimErr.message }
    }
  } else {
    sendRowId = claim!.id
  }

  // Render (throws on an unresolved token — caught so the slot lands as failed).
  let subject: string
  let bodyHtml: string
  try {
    const vars = contactVars(contact)
    subject = renderTemplate(template.subject ?? '', vars, { escape: false })
    bodyHtml = renderTemplate(template.body_html ?? '', vars)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Template render failed'
    await db.from('outreach_sends').update({ status: 'failed', error: message }).eq('id', sendRowId)
    return { ok: false, error: message, kind: 'render' }
  }

  // Outreach footer: reduced address (no street/postcode — see footer.ts) plus the
  // unsubscribe + privacy links that discharge the Article 14 duty.
  const settings = await getCompanySettings(db)
  const confirmUnsubUrl = `${APP_URL}/unsubscribe?token=${recipient.unsubscribe_token}`
  const oneClickUnsubUrl = `${APP_URL}/api/outreach/unsubscribe/${recipient.unsubscribe_token}`
  bodyHtml += renderOutreachFooterHtml(settings, { confirmUnsubUrl })

  const { data: sent, error: sendErr } = await resend.emails.send({
    from: `${campaign.from_name ?? 'Trailhead'} <${campaign.from_email}>`,
    to: email,
    replyTo: campaign.reply_to ?? undefined,
    subject,
    html: bodyHtml,
    headers: {
      'List-Unsubscribe': `<${oneClickUnsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [
      { name: 'campaign', value: campaign.id },
      { name: 'recipient', value: recipient.id },
    ],
  })

  if (sendErr || !sent) {
    await db.from('outreach_sends').update({ status: 'failed', subject, error: sendErr?.message ?? 'send failed' }).eq('id', sendRowId)
    return { ok: false, error: sendErr?.message ?? 'send failed' }
  }

  await db.from('outreach_sends').update({ resend_email_id: sent.id, subject, status: 'sent', sent_at: new Date().toISOString() }).eq('id', sendRowId)
  return { ok: true, sendId: sendRowId, resendId: sent.id }
}

export type TestSendResult = { ok: true } | { ok: false; error: string }

/**
 * Send a one-off TEST of a campaign step to an arbitrary address, rendered exactly
 * as a real send would be — INCLUDING the per-channel override resolved from the
 * chosen contact's channel (the override is the bit most likely to be misconfigured,
 * so a test with a fixed sample contact would miss it).
 *
 * A test is a deliberate human action, so it ignores the send window, send days and
 * daily cap. It deliberately writes NOTHING: no outreach_recipients row, no
 * outreach_sends row (which would corrupt the stats view and burn the unique
 * (recipient_id, step_id) slot a real send needs). It refuses — visibly — for a
 * suppressed or do-not-email destination rather than looking like a send failure,
 * and lets a bad-merge-tag render error surface, which is most of the point.
 */
export async function sendTestEmail({ campaignId, contactId, toEmail, stepNumber }: {
  campaignId: string
  contactId: string
  toEmail: string
  stepNumber: number
}): Promise<TestSendResult> {
  if (!resend) return { ok: false, error: 'RESEND_API_KEY is not configured' }
  const db = supabaseService
  const dest = toEmail.trim()
  if (!dest) return { ok: false, error: 'Enter a destination address for the test.' }

  const { data: campaign } = await db.from('outreach_campaigns').select('*').eq('id', campaignId).maybeSingle<OutreachCampaign>()
  if (!campaign || !campaign.from_email) return { ok: false, error: 'Campaign is missing its sending identity (from email).' }

  const { data: contact } = await db.from('contacts').select('*').eq('id', contactId).maybeSingle<Contact>()
  if (!contact) return { ok: false, error: 'Pick a sample contact to render the test against.' }

  // Compliance guards on the DESTINATION (not the sample contact): a test must
  // never reach a suppressed or do-not-email address, and must say so out loud.
  if (await isSuppressed(db, dest)) return { ok: false, error: `${dest} is on the suppression list, so the test was not sent.` }
  const { data: destContacts } = await db.from('contacts').select('do_not_email').ilike('email', dest)
  if ((destContacts ?? []).some((c) => c.do_not_email)) return { ok: false, error: `${dest} is marked do-not-email, so the test was not sent.` }

  // Resolve the step by its step_number, then its template, honouring the
  // per-channel override for the chosen contact's channel.
  const { data: steps } = await db.from('outreach_campaign_steps').select('*').eq('campaign_id', campaign.id).order('step_number', { ascending: true })
  const stepList = (steps ?? []) as OutreachCampaignStep[]
  if (stepList.length === 0) return { ok: false, error: 'This campaign has no steps to test yet.' }
  const step = stepList.find((s) => s.step_number === stepNumber) ?? stepList[0]

  let templateId = step.template_id
  if (contact.channel) {
    const { data: override } = await db.from('outreach_step_template_overrides').select('template_id').eq('step_id', step.id).eq('channel', contact.channel).maybeSingle<{ template_id: string }>()
    if (override) templateId = override.template_id
  }
  const { data: template } = await db.from('outreach_templates').select('*').eq('id', templateId ?? '').maybeSingle<OutreachTemplate>()
  if (!template) return { ok: false, error: `Step ${step.step_number} has no template for this contact's channel.` }

  // Render exactly as a real send would (a render error is surfaced, not swallowed).
  let subject: string
  let bodyHtml: string
  try {
    const vars = contactVars(contact)
    subject = renderTemplate(template.subject ?? '', vars, { escape: false })
    bodyHtml = renderTemplate(template.body_html ?? '', vars)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Template render failed.' }
  }

  // Fresh throwaway unsubscribe token: unknown tokens already no-op and return 200,
  // so the links in a test are safe to click and can't suppress anyone.
  const token = randomUUID()
  const settings = await getCompanySettings(db)
  const confirmUnsubUrl = `${APP_URL}/unsubscribe?token=${token}`
  const oneClickUnsubUrl = `${APP_URL}/api/outreach/unsubscribe/${token}`
  bodyHtml += renderOutreachFooterHtml(settings, { confirmUnsubUrl })

  const { error: sendErr } = await resend.emails.send({
    from: `${campaign.from_name ?? 'Trailhead'} <${campaign.from_email}>`,
    to: dest,
    replyTo: campaign.reply_to ?? undefined,
    subject: `[TEST] ${subject}`,
    html: bodyHtml,
    headers: {
      'List-Unsubscribe': `<${oneClickUnsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [
      { name: 'campaign', value: campaign.id },
      { name: 'test', value: 'true' },
    ],
  })
  if (sendErr) return { ok: false, error: sendErr.message }
  return { ok: true }
}
