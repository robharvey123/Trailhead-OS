import { supabaseService } from '@/lib/supabase/service'
import { resend } from '@/lib/email/resend'
import { getCompanySettings } from '@/lib/company-settings'
import { renderTemplate } from './render'
import type { Contact, OutreachCampaign, OutreachCampaignStep, OutreachRecipient, OutreachTemplate } from '@/lib/types'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trailheadholdings.uk').replace(/\/$/, '')

export type SendResult =
  | { ok: true; sendId: string; resendId: string | null }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; error: string }

function escapeHtml(v: string) {
  return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/**
 * Send the current step's email for one recipient through Resend, from the
 * campaign's own sending identity, and record an outreach_sends row. Refuses to
 * send when the address is suppressed or the contact is do_not_email.
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

  // Compliance guards — refuse rather than send.
  if (contact.do_not_email) return { ok: false, skipped: true, reason: 'do_not_email' }
  const { data: suppressed } = await db.from('email_suppressions').select('id').ilike('email', email).maybeSingle()
  if (suppressed) return { ok: false, skipped: true, reason: 'suppressed' }

  // Current step (0-indexed into the ordered step list) + its template.
  const { data: steps } = await db.from('outreach_campaign_steps').select('*').eq('campaign_id', campaign.id).order('step_number', { ascending: true })
  const step = ((steps ?? []) as OutreachCampaignStep[])[recipient.current_step]
  if (!step) return { ok: false, error: `No step at index ${recipient.current_step}` }
  const { data: template } = await db.from('outreach_templates').select('*').eq('id', step.template_id ?? '').maybeSingle<OutreachTemplate>()
  if (!template) return { ok: false, error: 'Template not found' }

  const vars: Record<string, string> = {
    email_greeting: (contact.email_greeting ?? '').trim() || 'there',
    company: contact.company ?? '',
    name: contact.name ?? '',
    city: contact.city ?? '',
    channel: contact.channel ?? '',
    sub_trade: contact.sub_trade ?? '',
    size_signal: contact.size_signal ?? '',
  }
  const subject = renderTemplate(template.subject ?? '', vars, { escape: false })
  let bodyHtml = renderTemplate(template.body_html ?? '', vars)

  // Legally-required + deliverability footer: registered address + unsubscribe.
  const settings = await getCompanySettings(db).catch(() => null)
  const unsubUrl = `${APP_URL}/api/outreach/unsubscribe/${recipient.unsubscribe_token}`
  const address = settings
    ? [settings.company_name, settings.address_line1, settings.city, settings.postcode, settings.country].filter(Boolean).join(', ')
    : 'Trailhead Holdings Ltd'
  bodyHtml += `
    <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.6">
      <p style="margin:0">${escapeHtml(address)}</p>
      <p style="margin:6px 0 0"><a href="${unsubUrl}" style="color:#94a3b8;text-decoration:underline">Unsubscribe from these emails</a></p>
    </div>`

  const { data: sent, error: sendErr } = await resend.emails.send({
    from: `${campaign.from_name ?? 'Trailhead'} <${campaign.from_email}>`,
    to: email,
    replyTo: campaign.reply_to ?? undefined,
    subject,
    html: bodyHtml,
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [
      { name: 'campaign', value: campaign.id },
      { name: 'recipient', value: recipient.id },
    ],
  })

  if (sendErr || !sent) {
    await db.from('outreach_sends').insert({
      campaign_id: campaign.id, recipient_id: recipient.id, step_id: step.id,
      subject, status: 'failed', error: sendErr?.message ?? 'send failed',
    })
    return { ok: false, error: sendErr?.message ?? 'send failed' }
  }

  const { data: sendRow } = await db.from('outreach_sends').insert({
    campaign_id: campaign.id, recipient_id: recipient.id, step_id: step.id,
    resend_email_id: sent.id, subject, status: 'sent', sent_at: new Date().toISOString(),
  }).select('id').single()

  return { ok: true, sendId: sendRow?.id ?? '', resendId: sent.id }
}
