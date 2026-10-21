import type { SupabaseClient } from '@supabase/supabase-js'
import { resend } from '@/lib/email/resend'

export interface SenderIdentity {
  user_id: string
  from_name: string
  from_email: string
  reply_to: string | null
  updated_at: string
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split('@')[1] ?? ''
}

export async function getVerifiedSendingDomains(admin: SupabaseClient): Promise<string[]> {
  const { data } = await admin.from('os_company_settings').select('verified_sending_domains').limit(1).maybeSingle()
  return ((data?.verified_sending_domains as string[] | null) ?? []).map((d) => d.trim().toLowerCase()).filter(Boolean)
}

/** Resend's view of a domain: 'verified', another status, or null if Resend can't be asked. */
export async function resendDomainStatus(domain: string): Promise<string | null> {
  if (!resend) return null
  try {
    const { data, error } = await resend.domains.list()
    if (error || !data) return null
    const list = (data as { data?: Array<{ name: string; status: string }> }).data ?? []
    const hit = list.find((d) => d.name.toLowerCase() === domain)
    return hit ? hit.status : 'not_in_resend'
  } catch {
    return null
  }
}

export type SenderCheck = { ok: true } | { ok: false; error: string }

/**
 * A from address is allowed only when its domain is in the settings list AND
 * Resend says it is verified. Both, so a typo in settings can't open up an
 * unverified domain, and a domain verified in Resend for something else isn't
 * usable until Rob allows it here.
 */
export async function checkSenderAddress(admin: SupabaseClient, fromEmail: string): Promise<SenderCheck> {
  const email = fromEmail.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid from address.' }
  const domain = emailDomain(email)
  const allowed = await getVerifiedSendingDomains(admin)
  if (!allowed.includes(domain)) {
    return {
      ok: false,
      error: allowed.length
        ? `${domain} is not an allowed sending domain. Allowed: ${allowed.join(', ')}.`
        : 'No sending domains are allowed yet. Rob adds them under Sales settings.',
    }
  }
  const status = await resendDomainStatus(domain)
  if (status === null) return { ok: false, error: 'Could not confirm the domain with Resend. Try again in a minute.' }
  if (status !== 'verified') {
    return { ok: false, error: status === 'not_in_resend' ? `${domain} is not set up in Resend.` : `${domain} is ${status.replace(/_/g, ' ')} in Resend, not verified.` }
  }
  return { ok: true }
}
