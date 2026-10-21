'use server'

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { resend, DEFAULT_RESEND_FROM } from '@/lib/email/resend'
import { appUrl } from '@/lib/auth/app-url'
import { rateLimit } from '@/lib/rate-limit'

export type ForgotResult = { ok: true } | { ok: false; error: string }

const SET_PASSWORD_PATH = '/auth/set-password'

/**
 * Email a one-time password reset link. Always answers the same way whether
 * or not the address has an account (no email enumeration). The link goes
 * through the scanner-safe /auth/confirm → /auth/accept flow, then to
 * /auth/set-password.
 */
export async function requestPasswordReset(rawEmail: string): Promise<ForgotResult> {
  const email = (rawEmail ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' }

  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (!rateLimit(`pw-reset:ip:${ip}`, 5, 15 * 60_000).ok || !rateLimit(`pw-reset:email:${email}`, 3, 15 * 60_000).ok) {
    return { ok: false, error: 'Too many requests. Try again in 15 minutes.' }
  }

  if (!resend) return { ok: false, error: 'Email is not configured here, so a reset link cannot be sent.' }

  const admin = createAdminClient()
  // generateLink('recovery') only works for an existing user; anything else is
  // swallowed so the response doesn't reveal whether the account exists.
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })
  const tokenHash = data?.properties?.hashed_token
  if (error || !tokenHash) return { ok: true }

  const params = new URLSearchParams({ token_hash: tokenHash, type: 'recovery', next: SET_PASSWORD_PATH })
  const link = `${appUrl()}/auth/confirm?${params.toString()}`
  try {
    await resend.emails.send({
      from: DEFAULT_RESEND_FROM,
      to: email,
      subject: 'Reset your Trailhead OS password',
      html: [
        '<p>Hi,</p>',
        '<p>Someone asked to reset the password for this Trailhead OS account.</p>',
        `<p><a href="${link}">Choose a new password</a></p>`,
        '<p>The link works once and expires soon. If you did not ask for this, ignore this email and your password stays the same.</p>',
      ].join('\n'),
    })
  } catch {
    // Same answer either way; the person can ask again.
  }
  return { ok: true }
}
